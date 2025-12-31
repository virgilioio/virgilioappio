import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

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
  interviewerId: string;
  interviewerName: string;
  isOwnTask: boolean;
}

export function usePendingScorecards() {
  const { user } = useAuth();
  const permissions = usePermissions();
  
  // Admins see all pending scorecards in their tenant
  const isAdmin = permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin;

  return useQuery({
    queryKey: ['pending-scorecards', user?.id, isAdmin],
    queryFn: async (): Promise<PendingScorecard[]> => {
      if (!user?.id) return [];

      // Fetch past bookings (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Build query - admins see all, others see only their own
      let bookingsQuery = supabase
        .from('scheduled_bookings')
        .select(`
          id,
          scheduled_start,
          scheduled_end,
          status,
          interviewer_id,
          job_hiring_stage_id,
          job_candidate_association_id,
          interviewer:profiles!scheduled_bookings_interviewer_id_fkey(first_name, last_name),
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
        .lt('scheduled_start', new Date().toISOString())
        .gte('scheduled_start', thirtyDaysAgo.toISOString())
        .not('status', 'eq', 'cancelled')
        .order('scheduled_start', { ascending: false });

      // Non-admins only see their own bookings
      if (!isAdmin) {
        bookingsQuery = bookingsQuery.eq('interviewer_id', user.id);
      }

      const { data: bookings, error: bookingsError } = await bookingsQuery;

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      if (!bookings || bookings.length === 0) return [];

      // Fetch scorecards - for admins get all, for others just their own
      let scorecardsQuery = supabase
        .from('job_stage_scorecards')
        .select('id, association_id, stage_instance_id, created_by');
      
      if (!isAdmin) {
        scorecardsQuery = scorecardsQuery.eq('created_by', user.id);
      }

      const { data: scorecards, error: scorecardsError } = await scorecardsQuery;

      if (scorecardsError) {
        console.error('Error fetching scorecards:', scorecardsError);
        throw scorecardsError;
      }

      // Create a set of association+stage+interviewer combos that have scorecards
      const scorecardKeys = new Set(
        (scorecards || []).map(sc => `${sc.association_id}:${sc.stage_instance_id}:${sc.created_by}`)
      );

      // Filter bookings that don't have a scorecard from the interviewer
      const pendingScorecards: PendingScorecard[] = [];
      
      for (const booking of bookings) {
        const association = booking.job_candidate_associations as any;
        const stage = booking.job_hiring_stages as any;
        const interviewer = booking.interviewer as any;
        
        if (!association || !stage) continue;
        
        // Key includes interviewer_id to check if THAT interviewer submitted
        const key = `${association.id}:${booking.job_hiring_stage_id}:${booking.interviewer_id}`;
        
        // Skip if scorecard already exists from this interviewer
        if (scorecardKeys.has(key)) continue;
        
        const interviewerName = interviewer 
          ? `${interviewer.first_name || ''} ${interviewer.last_name || ''}`.trim() || 'Unknown'
          : 'Unknown';
        
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
          interviewerId: booking.interviewer_id,
          interviewerName,
          isOwnTask: booking.interviewer_id === user.id,
        });
      }

      return pendingScorecards;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
