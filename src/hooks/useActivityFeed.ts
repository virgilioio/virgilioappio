import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
}

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
      
      return (data || []) as Activity[];
    },
    enabled: !!candidateId,
  });
}
