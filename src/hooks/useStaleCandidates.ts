import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export interface StaleCandidate {
  associationId: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  stageId: string;
  stageName: string;
  enteredStageAt: string;
  daysInStage: number;
}

const STALE_THRESHOLD_DAYS = 7;

export function useStaleCandidates() {
  return useQuery({
    queryKey: ['stale-candidates'],
    queryFn: async (): Promise<StaleCandidate[]> => {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - STALE_THRESHOLD_DAYS);

      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select(`
          id,
          candidate_id,
          job_id,
          current_stage_id,
          entered_stage_at,
          candidates!inner(candidate_name),
          jobs!inner(id, title, deleted_at),
          job_hiring_stages!inner(
            id,
            job_stages!inner(stage_name, stage_type)
          )
        `)
        .eq('status', 'active')
        .is('jobs.deleted_at', null)
        .not('current_stage_id', 'is', null)
        .not('entered_stage_at', 'is', null)
        .lt('entered_stage_at', thresholdDate.toISOString())
        .order('entered_stage_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching stale candidates:', error);
        throw error;
      }

      if (!data) return [];

      // Filter out terminal stages and map to our interface
      const staleCandidates: StaleCandidate[] = [];

      for (const row of data) {
        const stage = row.job_hiring_stages as any;
        const stageInfo = stage?.job_stages;
        
        // Skip terminal stages (offer, onboarding)
        if (!stageInfo || ['offer', 'onboarding'].includes(stageInfo.stage_type)) {
          continue;
        }

        const candidate = row.candidates as any;
        const job = row.jobs as any;

        if (!candidate || !job) continue;

        const enteredAt = new Date(row.entered_stage_at!);
        const daysInStage = differenceInDays(new Date(), enteredAt);

        staleCandidates.push({
          associationId: row.id,
          candidateId: row.candidate_id,
          candidateName: candidate.candidate_name || 'Unknown',
          jobId: row.job_id,
          jobTitle: job.title || 'Unknown Job',
          stageId: stage.id,
          stageName: stageInfo.stage_name || 'Unknown Stage',
          enteredStageAt: row.entered_stage_at!,
          daysInStage,
        });
      }

      return staleCandidates;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
