import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityEmailBody {
  id: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  snippet: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  direction: string | null;
  attachments: any;
}

export interface Activity {
  id: string;
  user_id: string;
  organization_id: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  author_first_name?: string;
  author_last_name?: string;
  author_email?: string;
  emailBody?: ActivityEmailBody | null;
}

const EMAIL_ACTIVITY_TYPES = new Set(['candidate_email_sent', 'candidate_email_received']);

export function useActivityFeed(candidateId?: string, jobId?: string) {
  return useQuery({
    queryKey: ['activity-feed', candidateId, jobId],
    queryFn: async () => {
      if (!candidateId) return [];
      
      // Call the secure database function to get activities
      const { data, error } = await supabase.rpc('get_candidate_activities', {
        p_candidate_id: candidateId,
        p_job_id: jobId || null,
      });
      
      if (error) throw error;
      
      const activities = (data || []) as Activity[];

      // Resolve email bodies for email activities in one batched read.
      const logIds = [
        ...new Set(
          activities
            .filter(a => EMAIL_ACTIVITY_TYPES.has(a.activity_type))
            .map(a => a.metadata?.email_log_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        ),
      ];

      if (logIds.length === 0) return activities;

      const { data: logs, error: logsError } = await supabase
        .from('email_logs')
        .select(
          'id, subject, body_html, body_text, snippet, from_address, to_addresses, direction, attachments'
        )
        .in('id', logIds);

      // Missing bodies are not an error — rows simply render without a preview.
      if (logsError) return activities;

      const logMap = new Map((logs || []).map(l => [l.id, l as ActivityEmailBody]));

      return activities.map(a =>
        EMAIL_ACTIVITY_TYPES.has(a.activity_type)
          ? { ...a, emailBody: logMap.get(a.metadata?.email_log_id) ?? null }
          : a
      );
    },
    enabled: !!candidateId,
  });
}
