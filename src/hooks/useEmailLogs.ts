import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useEmailLogs(candidateId?: string, jobId?: string) {
  return useQuery({
    queryKey: ['email-logs', candidateId, jobId],
    queryFn: async () => {
      if (!candidateId) return [];
      
      let query = supabase
        .from('email_logs')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!candidateId,
  });
}
