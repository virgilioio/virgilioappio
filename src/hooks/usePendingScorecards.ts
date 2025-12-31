import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PendingScorecard {
  bookingId: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  stageName: string;
  stageInstanceId: string;
  associationId: string;
  scheduledStart: string;
}

export function usePendingScorecards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-scorecards', user?.id],
    queryFn: async (): Promise<PendingScorecard[]> => {
      if (!user?.id) return [];

      // Fetch past bookings where user was interviewer (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: bookings, error: bookingsError } = await supabase
        .from('scheduled_bookings')
        .select(`
          id,
          scheduled_start,
          scheduled_end,
          status,
          job_hiring_stage_id,
          job_candidate_association_id,
          job_candidate_associations!inner(
            id,
            candidate_id,
            job_id,
            candidates(id, candidate_name),
            jobs(id, title)
          ),
          job_hiring_stages!inner(
            id,
            job_stages(stage_name)
          )
        `)
        .eq('interviewer_id', user.id)
        .lt('scheduled_start', new Date().toISOString())
        .gte('scheduled_start', thirtyDaysAgo.toISOString())
        .not('status', 'eq', 'cancelled')
        .order('scheduled_start', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      if (!bookings || bookings.length === 0) return [];

      // Fetch user's existing scorecards
      const { data: scorecards, error: scorecardsError } = await supabase
        .from('job_stage_scorecards')
        .select('id, association_id, stage_instance_id')
        .eq('created_by', user.id);

      if (scorecardsError) {
        console.error('Error fetching scorecards:', scorecardsError);
        throw scorecardsError;
      }

      // Create a set of association+stage combos that have scorecards
      const scorecardKeys = new Set(
        (scorecards || []).map(sc => `${sc.association_id}:${sc.stage_instance_id}`)
      );

      // Filter bookings that don't have a scorecard
      const pendingScorecards: PendingScorecard[] = [];
      
      for (const booking of bookings) {
        const association = booking.job_candidate_associations as any;
        const stage = booking.job_hiring_stages as any;
        
        if (!association || !stage) continue;
        
        const key = `${association.id}:${booking.job_hiring_stage_id}`;
        
        // Skip if scorecard already exists
        if (scorecardKeys.has(key)) continue;
        
        pendingScorecards.push({
          bookingId: booking.id,
          candidateId: association.candidates?.id || association.candidate_id,
          candidateName: association.candidates?.candidate_name || 'Unknown',
          jobId: association.jobs?.id || association.job_id,
          jobTitle: association.jobs?.title || 'Unknown Job',
          stageName: stage.job_stages?.stage_name || 'Interview',
          stageInstanceId: booking.job_hiring_stage_id,
          associationId: association.id,
          scheduledStart: booking.scheduled_start,
        });
      }

      return pendingScorecards;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
