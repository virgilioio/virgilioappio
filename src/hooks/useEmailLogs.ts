import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export function useEmailLogs(candidateId?: string, jobId?: string) {
  const queryClient = useQueryClient();

  // Setup Realtime subscription for email_logs
  useEffect(() => {
    if (!candidateId) return;

    console.log('[Email Logs] Setting up Realtime subscription for candidate:', candidateId);

    const channel = supabase
      .channel('email-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_logs',
          filter: `candidate_id=eq.${candidateId}`,
        },
        (payload) => {
          console.log('[Email Logs] Realtime update received:', payload);
          // Invalidate and refetch email logs when changes occur
          queryClient.invalidateQueries({ queryKey: ['email-logs', candidateId, jobId] });
        }
      )
      .subscribe();

    return () => {
      console.log('[Email Logs] Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [candidateId, jobId, queryClient]);

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
