import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StageBookingInterviewer {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_primary: boolean;
  has_scorecard: boolean;
}

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
          event: '*',
          schema: 'public',
          table: 'scheduled_bookings',
          filter: `candidate_id=eq.${candidateId}`,
        },
        (payload) => {
          console.log('[StageBookings] Real-time update received:', payload.eventType);
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

      const bookingIds = data.map(b => b.id);

      // Fetch all attendees for these bookings
      const { data: attendees } = await supabase
        .from('scheduled_booking_attendees')
        .select('booking_id, user_id, role')
        .in('booking_id', bookingIds);

      // Build expected interviewer set per booking (primary + attendees, dedup)
      const interviewerIdsByBooking = new Map<string, Set<string>>();
      for (const b of data) {
        const set = new Set<string>();
        if (b.interviewer_id) set.add(b.interviewer_id);
        interviewerIdsByBooking.set(b.id, set);
      }
      for (const a of attendees || []) {
        const set = interviewerIdsByBooking.get(a.booking_id);
        if (set && a.user_id) set.add(a.user_id);
      }

      // All unique interviewer ids
      const allInterviewerIds = [
        ...new Set(
          [...interviewerIdsByBooking.values()].flatMap(s => [...s])
        ),
      ];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, avatar_url')
        .in('user_id', allInterviewerIds);
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Fetch scorecards for this association+stage to compute completion
      // Get association_id from any booking
      const associationIds = [
        ...new Set(data.map(b => b.job_candidate_association_id).filter(Boolean)),
      ];

      let scorecardAuthors = new Set<string>();
      if (associationIds.length > 0) {
        const { data: scorecards } = await supabase
          .from('job_stage_scorecards')
          .select('created_by, association_id, stage_instance_id')
          .in('association_id', associationIds as string[])
          .eq('stage_instance_id', jhsId)
          .eq('is_ai_draft', false);
        scorecardAuthors = new Set(
          (scorecards || []).map(s => s.created_by).filter(Boolean) as string[]
        );
      }

      return data.map(booking => {
        const expectedSet = interviewerIdsByBooking.get(booking.id) || new Set<string>();
        const interviewers: StageBookingInterviewer[] = [...expectedSet].map(uid => {
          const p = profilesMap.get(uid);
          return {
            user_id: uid,
            first_name: p?.first_name ?? null,
            last_name: p?.last_name ?? null,
            email: p?.email ?? null,
            avatar_url: p?.avatar_url ?? null,
            is_primary: uid === booking.interviewer_id,
            has_scorecard: scorecardAuthors.has(uid),
          };
        });

        const submittedCount = interviewers.filter(i => i.has_scorecard).length;
        const expectedCount = interviewers.length;

        return {
          ...booking,
          interviewer_profile: profilesMap.get(booking.interviewer_id),
          interviewers,
          scorecard_submitted_count: submittedCount,
          scorecard_expected_count: expectedCount,
          scorecard_complete: expectedCount > 0 && submittedCount >= expectedCount,
        };
      });
    },
    enabled: !!jhsId && !!candidateId,
  });
}
