import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AIDraftRequest {
  candidateId: string;
  jobId: string;
  prompt: string;
  emailType?: string;
  senderName?: string;
}

interface AIDraftResponse {
  subject: string;
  body: string;
}

export function useAIDraftEmail() {
  return useMutation({
    mutationFn: async ({ candidateId, jobId, prompt, emailType, senderName }: AIDraftRequest): Promise<AIDraftResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-email-draft', {
        body: {
          candidate_id: candidateId,
          job_id: jobId,
          prompt,
          email_type: emailType,
          sender_name: senderName,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate email draft');
      }

      if (!data?.subject || !data?.body) {
        throw new Error('Invalid response from AI');
      }

      return data as AIDraftResponse;
    },
  });
}
