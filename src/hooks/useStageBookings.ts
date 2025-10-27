import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useStageBookings(
  jhsId: string | null,
  candidateId: string | null
) {
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
        .select('user_id, first_name, last_name, email')
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
