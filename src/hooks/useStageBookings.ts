import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useStageBookings(
  jhsId: string | null,
  candidateId: string | null
) {
  const queryClient = useQueryClient();

  // Real-time subscription for booking updates
  useEffect(() => {
    if (!jhsId || !candidateId) return;

    const channel = supabase
      .channel(`stage-bookings-${jhsId}-${candidateId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'scheduled_bookings',
          filter: `candidate_id=eq.${candidateId}`,
        },
        (payload) => {
          console.log('[StageBookings] Real-time update received:', payload.eventType);
          // Invalidate query to refetch with updated data
          queryClient.invalidateQueries({ 
            queryKey: ['stage-bookings', jhsId, candidateId] 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jhsId, candidateId, queryClient]);

  return useQuery({
    queryKey: ['stage-bookings', jhsId, candidateId],
    queryFn: async () => {
      if (!jhsId || !candidateId) return [];
      
      const { data, error } = await supabase
        .from('scheduled_bookings')
        .select('*')
        .eq('job_hiring_stage_id', jhsId)
        .eq('candidate_id', candidateId)
        .eq('status', 'confirmed')
        .order('scheduled_start', { ascending: true });
      
      if (error) throw error;
      if (!data) return [];

      // Fetch interviewer profiles separately
      const interviewerIds = [...new Set(data.map(b => b.interviewer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, avatar_url')
        .in('user_id', interviewerIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return data.map(booking => ({
        ...booking,
        interviewer_profile: profilesMap.get(booking.interviewer_id),
      }));
    },
    enabled: !!jhsId && !!candidateId,
  });
}
