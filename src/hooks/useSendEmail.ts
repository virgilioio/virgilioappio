import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SendEmailRequest {
  from_email: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_text?: string;
  body_html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    content_type: string;
  }>;
  candidate_id?: string;
  job_id?: string;
  in_reply_to_message_id?: string;
  // Contextual booking link context
  jhs_id?: string; // job_hiring_stage_id for contextual booking links
  association_id?: string; // job_candidate_association_id for contextual booking links
}

/**
 * What every sent email refreshes: the candidate's email logs and Activity feed, and any
 * screen listening for `gio:email-sent` (the Inbox brings the new message in).
 */
export function afterEmailSent(
  queryClient: QueryClient,
  request: Pick<SendEmailRequest, 'candidate_id' | 'job_id'>,
) {
  if (request.candidate_id) {
    queryClient.invalidateQueries({ queryKey: ['email-logs', request.candidate_id] });
    queryClient.invalidateQueries({ queryKey: ['activity-feed', request.candidate_id] });
    if (request.job_id) {
      queryClient.invalidateQueries({ queryKey: ['activity-feed', request.candidate_id, request.job_id] });
    }
  }
  queryClient.invalidateQueries({ queryKey: ['email-logs'] });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gio:email-sent', { detail: request }));
}

export function useSendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SendEmailRequest) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('send-user-email', {
        body: request,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      toast.success('Email sent successfully');
      afterEmailSent(queryClient, variables);
    },
    onError: (error: Error) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });
}
