import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface BulkEmailInput {
  associationIds: string[];
  emailData: {
    fromEmail: string;
    subject: string;
    bodyHtml: string;
  };
  scheduleFor?: Date;
}

interface EmailProgress {
  total: number;
  completed: number;
  failed: number;
}

// Helper to resolve placeholders in text
function resolvePlaceholders(
  text: string,
  data: {
    candidateName?: string;
    candidateFirstName?: string;
    candidateEmail?: string;
    jobTitle?: string;
    jobDepartment?: string;
    jobLocation?: string;
    senderName?: string;
    senderFirstName?: string;
    senderLastName?: string;
    senderEmail?: string;
    senderTitle?: string;
    senderPhone?: string;
    senderLinkedin?: string;
    senderBookingLink?: string;
  }
): string {
  return text
    .replace(/\{\{candidate\.name\}\}/g, data.candidateName || '')
    .replace(/\{\{candidate\.first_name\}\}/g, data.candidateFirstName || '')
    .replace(/\{\{candidate\.email\}\}/g, data.candidateEmail || '')
    .replace(/\{\{job\.title\}\}/g, data.jobTitle || '')
    .replace(/\{\{job\.department\}\}/g, data.jobDepartment || '')
    .replace(/\{\{job\.location\}\}/g, data.jobLocation || '')
    .replace(/\{\{sender\.name\}\}/g, data.senderName || '')
    .replace(/\{\{sender\.first_name\}\}/g, data.senderFirstName || '')
    .replace(/\{\{sender\.last_name\}\}/g, data.senderLastName || '')
    .replace(/\{\{sender\.email\}\}/g, data.senderEmail || '')
    .replace(/\{\{sender\.title\}\}/g, data.senderTitle || '')
    .replace(/\{\{sender\.phone\}\}/g, data.senderPhone || '')
    .replace(/\{\{sender\.linkedin\}\}/g, data.senderLinkedin || '')
    .replace(/\{\{sender\.booking_link\}\}/g, data.senderBookingLink || '');
}

export function useBulkSendEmail() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [progress, setProgress] = useState<EmailProgress>({ total: 0, completed: 0, failed: 0 });

  const mutation = useMutation({
    mutationFn: async (input: BulkEmailInput) => {
      const { associationIds, emailData, scheduleFor } = input;

      setProgress({ total: associationIds.length, completed: 0, failed: 0 });

      // Fetch all associations with candidate and job info for email personalization
      const { data: associations, error: fetchError } = await supabase
        .from('job_candidate_associations')
        .select(`
          id,
          candidate_id,
          job_id,
          candidate:candidates!inner(id, candidate_name, email),
          job:jobs!inner(id, title, department, location, tenant_id, organization_id)
        `)
        .in('id', associationIds);

      if (fetchError) throw fetchError;
      if (!associations || associations.length === 0) {
        throw new Error('No valid associations found');
      }

      // Fetch sender profile for placeholder resolution
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, title, phone, linkedin_url')
        .eq('user_id', user?.id)
        .single();

      const senderName = senderProfile 
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim()
        : '';

      const results = await Promise.allSettled(
        associations.map(async (assoc) => {
          try {
            const candidate = assoc.candidate as any;
            const job = assoc.job as any;

            if (!candidate.email) {
              throw new Error(`No email address for candidate ${candidate.candidate_name}`);
            }

            // Resolve placeholders for this candidate
            const placeholderData = {
              candidateName: candidate.candidate_name,
              candidateFirstName: candidate.candidate_name?.split(' ')[0] || '',
              candidateEmail: candidate.email,
              jobTitle: job.title,
              jobDepartment: job.department,
              jobLocation: job.location,
              senderName,
              senderFirstName: (senderProfile as any)?.first_name || '',
              senderLastName: (senderProfile as any)?.last_name || '',
              senderEmail: (senderProfile as any)?.email || emailData.fromEmail,
              senderTitle: (senderProfile as any)?.title || '',
              senderPhone: (senderProfile as any)?.phone || '',
              senderLinkedin: (senderProfile as any)?.linkedin_url || '',
              senderBookingLink: '',
            };

            const resolvedSubject = resolvePlaceholders(emailData.subject, placeholderData);
            const resolvedBody = resolvePlaceholders(emailData.bodyHtml, placeholderData);

            if (scheduleFor) {
              // Schedule the email
              const { error: scheduleError } = await supabase
                .from('scheduled_emails')
                .insert({
                  tenant_id: job.tenant_id,
                  organization_id: job.organization_id,
                  scheduled_for: scheduleFor.toISOString(),
                  email_type: 'bulk_outreach',
                  from_email: emailData.fromEmail,
                  to_emails: [candidate.email],
                  subject: resolvedSubject,
                  body_html: resolvedBody,
                  candidate_id: candidate.id,
                  job_id: job.id,
                  association_id: assoc.id,
                  created_by: user?.id,
                  status: 'pending',
                });

              if (scheduleError) throw scheduleError;
            } else {
              // Send immediately via edge function
              const { error: sendError } = await supabase.functions.invoke('send-user-email', {
                body: {
                  from_email: emailData.fromEmail,
                  to: [candidate.email],
                  subject: resolvedSubject,
                  body_html: resolvedBody,
                  body_text: resolvedBody.replace(/<[^>]*>/g, ''),
                  candidate_id: candidate.id,
                  job_id: job.id,
                },
              });

              if (sendError) throw sendError;
            }

            setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
            return { success: true, candidateId: candidate.id };
          } catch (error) {
            setProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
            throw error;
          }
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      return { succeeded, failed, total: associations.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      
      const action = variables.scheduleFor ? 'scheduled' : 'sent';
      if (data.failed === 0) {
        toast({
          title: 'Emails sent',
          description: `${data.succeeded} email${data.succeeded > 1 ? 's' : ''} ${action} successfully.`,
        });
      } else {
        toast({
          title: 'Partially completed',
          description: `${data.succeeded} ${action}, ${data.failed} failed.`,
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send emails',
        variant: 'destructive',
      });
    },
  });

  return {
    sendBulkEmail: mutation.mutate,
    sendBulkEmailAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    progress,
    reset: () => setProgress({ total: 0, completed: 0, failed: 0 }),
  };
}
