import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { log } from '@/lib/logger';

export interface JobStageMetric {
  stage_id: string;
  stage_name: string;
  stage_type: string;
  count_in_stage: number;
  position: number;
}

export interface PipelineJobMetric {
  job_id: string;
  active_candidates: number;
  stages: JobStageMetric[];
  overall_start_count: number;
  overall_hired_count: number;
}

export function usePipelineJobMetrics(jobIds: string[]) {
  return useQuery({
    queryKey: ['pipeline-job-metrics', jobIds],
    queryFn: async (): Promise<PipelineJobMetric[]> => {
      if (!jobIds || jobIds.length === 0) {
        log.debug('[usePipelineJobMetrics] No job IDs provided');
        return [];
      }

      log.debug('[usePipelineJobMetrics] Fetching for jobs:', jobIds);
      
      const { data, error } = await supabase.rpc('get_pipeline_job_metrics', {
        job_ids: jobIds,
      });

      if (error) {
        log.error('[usePipelineJobMetrics] Error:', error);
        throw error;
      }

      log.debug('[usePipelineJobMetrics] Result:', data);
      return data as unknown as PipelineJobMetric[];
    },
    enabled: jobIds && jobIds.length > 0,
    staleTime: 30000, // 30s
  });
}
