import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    onSuccess: (data, variables) => {
      toast.success('Email sent successfully');
      
      // Invalidate email logs for this candidate
      if (variables.candidate_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['email-logs', variables.candidate_id] 
        });
        
        // Invalidate activity feed for this candidate
        queryClient.invalidateQueries({ 
          queryKey: ['activity-feed', variables.candidate_id] 
        });
        
        // Also invalidate with job_id if provided
        if (variables.job_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['activity-feed', variables.candidate_id, variables.job_id] 
          });
        }
      }
      
      // Invalidate all email logs
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });
}
