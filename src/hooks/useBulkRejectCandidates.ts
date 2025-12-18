import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { renderTemplate, buildPlaceholderData } from '@/utils/templateUtils';

export interface BulkRejectInput {
  associationIds: string[];
  rejectionReasonId?: string;
  sendEmail: boolean;
  emailData?: {
    fromEmail: string;
    subject: string;
    bodyHtml: string;
  };
  scheduleFor?: Date;
}

interface RejectProgress {
  total: number;
  completed: number;
  failed: number;
}

export function useBulkRejectCandidates() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [progress, setProgress] = useState<RejectProgress>({ total: 0, completed: 0, failed: 0 });

  const mutation = useMutation({
    mutationFn: async (input: BulkRejectInput) => {
      const { associationIds, rejectionReasonId, sendEmail, emailData, scheduleFor } = input;

      setProgress({ total: associationIds.length, completed: 0, failed: 0 });

      // Fetch all associations with candidate and job info for email personalization
      const { data: associations, error: fetchError } = await supabase
        .from('job_candidate_associations')
        .select(`
          id,
          candidate_id,
          job_id,
          current_stage_id,
          candidate:candidates!inner(id, candidate_name, email),
          job:jobs!inner(id, title, tenant_id, organization_id)
        `)
        .in('id', associationIds);

      if (fetchError) throw fetchError;
      if (!associations || associations.length === 0) {
        throw new Error('No valid associations found');
      }

      const results = await Promise.allSettled(
        associations.map(async (assoc, index) => {
          try {
            const candidate = assoc.candidate as any;
            const job = assoc.job as any;

            // Update association status
            const updateData: any = {
              status: 'rejected',
              rejection_reason_id: rejectionReasonId || null,
              rejected_at: new Date().toISOString(),
              rejected_by: user?.id,
            };

            if (sendEmail && scheduleFor) {
              updateData.rejection_email_scheduled_for = scheduleFor.toISOString();
            }

            const { error: updateError } = await supabase
              .from('job_candidate_associations')
              .update(updateData)
              .eq('id', assoc.id);

            if (updateError) throw updateError;

            // Handle email if enabled
            if (sendEmail && emailData && candidate.email) {
              // Build placeholder data using the utility function
              const placeholderData = buildPlaceholderData({
                candidate: {
                  candidate_name: candidate.candidate_name,
                  email: candidate.email,
                },
                job: {
                  title: job.title,
                },
              });

              // Resolve placeholders using the robust rendering function
              const resolvedSubject = renderTemplate(emailData.subject, placeholderData);
              const resolvedBody = renderTemplate(emailData.bodyHtml, placeholderData);

              if (scheduleFor) {
                // Schedule the email with contextual booking link data
                const { error: scheduleError } = await supabase
                  .from('scheduled_emails')
                  .insert({
                    tenant_id: job.tenant_id,
                    organization_id: job.organization_id,
                    scheduled_for: scheduleFor.toISOString(),
                    email_type: 'rejection',
                    from_email: emailData.fromEmail,
                    to_emails: [candidate.email],
                    subject: resolvedSubject,
                    body_html: resolvedBody,
                    candidate_id: candidate.id,
                    job_id: job.id,
                    association_id: assoc.id,
                    jhs_id: assoc.current_stage_id, // For contextual booking links
                    rejection_reason_id: rejectionReasonId,
                    created_by: user?.id,
                    status: 'pending',
                  });

                if (scheduleError) throw scheduleError;
              } else {
                // Send immediately via edge function with contextual booking link data
                const { error: sendError } = await supabase.functions.invoke('send-user-email', {
                  body: {
                    from_email: emailData.fromEmail,
                    to: [candidate.email],
                    subject: resolvedSubject,
                    body_html: resolvedBody,
                    body_text: resolvedBody.replace(/<[^>]*>/g, ''),
                    candidate_id: candidate.id,
                    job_id: job.id,
                    jhs_id: assoc.current_stage_id,
                    association_id: assoc.id,
                  },
                });

                if (sendError) throw sendError;

                // Mark email as sent
                await supabase
                  .from('job_candidate_associations')
                  .update({ rejection_email_sent_at: new Date().toISOString() })
                  .eq('id', assoc.id);
              }
            }

            setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
            return { success: true, id: assoc.id };
          } catch (error) {
            setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
            throw error;
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { successful, failed, total: associationIds.length };
    },
    onSuccess: (result, variables) => {
      if (result.failed === 0) {
        if (variables.sendEmail && variables.scheduleFor) {
          toast.success(`${result.successful} candidate(s) rejected. Emails scheduled.`);
        } else if (variables.sendEmail) {
          toast.success(`${result.successful} candidate(s) rejected. Emails sent.`);
        } else {
          toast.success(`${result.successful} candidate(s) rejected.`);
        }
      } else {
        toast.warning(`${result.successful} rejected, ${result.failed} failed.`);
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['job-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: (error: Error) => {
      console.error('Bulk rejection failed:', error);
      toast.error(`Bulk rejection failed: ${error.message}`);
    },
  });

  return {
    ...mutation,
    progress,
  };
}

