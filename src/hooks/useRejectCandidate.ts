import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSendEmail, SendEmailRequest } from '@/hooks/useSendEmail';
import { toast } from 'sonner';

export interface RejectCandidateInput {
  associationId: string;
  rejectionReasonId?: string;
  rejectionNotes?: string;
  sendEmail: boolean;
  emailData?: {
    fromEmail: string;
    toEmails: string[];
    subject: string;
    bodyHtml: string;
    candidateId?: string;
    jobId?: string;
  };
  scheduleFor?: Date; // If set, schedule the email instead of sending immediately
}

export function useRejectCandidate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const sendEmailMutation = useSendEmail();

  return useMutation({
    mutationFn: async (input: RejectCandidateInput) => {
      const { associationId, rejectionReasonId, rejectionNotes, sendEmail, emailData, scheduleFor } = input;

      // Get tenant_id from the association's job
      const { data: association, error: assocError } = await supabase
        .from('job_candidate_associations')
        .select('job_id, candidate_id, job:jobs!inner(tenant_id, organization_id)')
        .eq('id', associationId)
        .single();

      if (assocError) throw assocError;

      const tenantId = (association.job as any)?.tenant_id;
      const organizationId = (association.job as any)?.organization_id;

      // Update the association status to rejected with metadata
      const updateData: any = {
        status: 'rejected',
        rejection_reason_id: rejectionReasonId || null,
        rejection_notes: rejectionNotes || null,
        rejected_at: new Date().toISOString(),
        rejected_by: user?.id,
      };

      if (sendEmail && scheduleFor) {
        updateData.rejection_email_scheduled_for = scheduleFor.toISOString();
      }

      const { error: updateError } = await supabase
        .from('job_candidate_associations')
        .update(updateData)
        .eq('id', associationId);

      if (updateError) throw updateError;

      // Cancel any scheduled interviews for this candidate (best-effort)
      try {
        const { data: activeBookings } = await supabase
          .from('scheduled_bookings')
          .select('id')
          .eq('candidate_id', association.candidate_id)
          .eq('job_id', association.job_id)
          .in('status', ['confirmed', 'rescheduled']);

        if (activeBookings?.length) {
          await Promise.allSettled(
            activeBookings.map(booking =>
              supabase.functions.invoke('cancel-booking', {
                body: { booking_id: booking.id, reason: 'Candidate rejected' },
              })
            )
          );
        }
      } catch (cancelError) {
        console.error('Failed to cancel interviews on rejection:', cancelError);
      }

      // Handle email
      if (sendEmail && emailData) {
        if (scheduleFor) {
          // Schedule the email for later
          const { error: scheduleError } = await supabase
            .from('scheduled_emails')
            .insert({
              tenant_id: tenantId,
              organization_id: organizationId,
              scheduled_for: scheduleFor.toISOString(),
              email_type: 'rejection',
              from_email: emailData.fromEmail,
              to_emails: emailData.toEmails,
              subject: emailData.subject,
              body_html: emailData.bodyHtml,
              candidate_id: emailData.candidateId,
              job_id: emailData.jobId,
              association_id: associationId,
              rejection_reason_id: rejectionReasonId,
              created_by: user?.id,
              status: 'pending',
            });

          if (scheduleError) throw scheduleError;
        } else {
          // Send immediately
          const request: SendEmailRequest = {
            from_email: emailData.fromEmail,
            to: emailData.toEmails,
            subject: emailData.subject,
            body_html: emailData.bodyHtml,
            body_text: emailData.bodyHtml.replace(/<[^>]*>/g, ''),
            candidate_id: emailData.candidateId,
            job_id: emailData.jobId,
          };

          await sendEmailMutation.mutateAsync(request);

          // Mark email as sent on the association
          await supabase
            .from('job_candidate_associations')
            .update({ rejection_email_sent_at: new Date().toISOString() })
            .eq('id', associationId);
        }
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      if (variables.sendEmail && variables.scheduleFor) {
        toast.success('Candidate rejected. Email scheduled.');
      } else if (variables.sendEmail) {
        toast.success('Candidate rejected and email sent.');
      } else {
        toast.success('Candidate rejected.');
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['job-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: (error: Error) => {
      console.error('Failed to reject candidate:', error);
      toast.error(`Failed to reject candidate: ${error.message}`);
    },
  });
}
