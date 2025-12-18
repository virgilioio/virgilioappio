import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { renderTemplate, buildPlaceholderData } from '@/utils/templateUtils';

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
          current_stage_id,
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

      const results = await Promise.allSettled(
        associations.map(async (assoc) => {
          try {
            const candidate = assoc.candidate as any;
            const job = assoc.job as any;

            if (!candidate.email) {
              throw new Error(`No email address for candidate ${candidate.candidate_name}`);
            }

            // Build placeholder data using the utility function
            const placeholderData = buildPlaceholderData({
              candidate: {
                candidate_name: candidate.candidate_name,
                email: candidate.email,
              },
              job: {
                title: job.title,
                department: job.department,
                location: job.location,
              },
              sender: {
                first_name: (senderProfile as any)?.first_name,
                last_name: (senderProfile as any)?.last_name,
                email: (senderProfile as any)?.email || emailData.fromEmail,
                title: (senderProfile as any)?.title,
                phone: (senderProfile as any)?.phone,
                linkedin_url: (senderProfile as any)?.linkedin_url,
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
                  email_type: 'bulk_outreach',
                  from_email: emailData.fromEmail,
                  to_emails: [candidate.email],
                  subject: resolvedSubject,
                  body_html: resolvedBody,
                  candidate_id: candidate.id,
                  job_id: job.id,
                  association_id: assoc.id,
                  jhs_id: assoc.current_stage_id, // For contextual booking links
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
