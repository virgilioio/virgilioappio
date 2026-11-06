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

export interface AITemplateRequest {
  instruction: string;
  subject: string;
  bodyHtml: string;
  jobId?: string | null;
  stageName?: string | null;
  purpose: 'automation' | 'template' | 'rejection';
  senderName?: string;
  variables?: Array<{ key: string; label: string }>;
}

/** Drafts or rewrites a template with Gio; variables come back as `{{key}}` (2026-11-06). */
export function useAITemplateRewrite() {
  return useMutation({
    mutationFn: async (r: AITemplateRequest): Promise<AIDraftResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-email-draft', {
        body: {
          mode: 'template',
          instruction: r.instruction,
          subject: r.subject,
          body_html: r.bodyHtml,
          job_id: r.jobId ?? null,
          stage_name: r.stageName ?? null,
          purpose: r.purpose,
          sender_name: r.senderName,
          variables: r.variables,
        },
      });
      if (error) throw new Error(error.message || 'Failed to rewrite the template');
      if (!data?.body_html) throw new Error('Invalid response from AI');
      return { subject: data.subject ?? '', body: data.body_html };
    },
  });
}
