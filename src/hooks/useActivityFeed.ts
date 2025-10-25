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
  author?: {
    email: string;
    full_name?: string;
  };
}

export function useActivityFeed(candidateId?: string, jobId?: string) {
  return useQuery({
    queryKey: ['activity-feed', candidateId, jobId],
    queryFn: async () => {
      if (!candidateId) return [];
      
      // Build query to get activities related to this candidate
      let query = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Filter by candidate_id in metadata or entity_id
      query = query.or(`entity_id.eq.${candidateId},metadata->>candidate_id.eq.${candidateId}`);
      
      // If jobId is provided, also filter by job_id in metadata
      if (jobId) {
        query = query.eq('metadata->>job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []) as Activity[];
    },
    enabled: !!candidateId,
  });
}
