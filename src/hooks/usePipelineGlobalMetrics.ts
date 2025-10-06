import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { log } from '@/lib/logger';

export interface PipelineGlobalMetrics {
  active_jobs: number;
  application_review_count: number;
  avg_days_in_application_review: number | null;
  active_candidates_count: number;
}

export interface PipelineFilters {
  userIds?: string[];
  jobStatuses?: string[];
  search?: string;
}

export function usePipelineGlobalMetrics(filters: PipelineFilters = {}) {
  return useQuery({
    queryKey: ['pipeline-global-metrics', filters],
    queryFn: async (): Promise<PipelineGlobalMetrics> => {
      log.debug('[usePipelineGlobalMetrics] Fetching with filters:', filters);
      
      const { data, error } = await supabase.rpc('get_pipeline_global_metrics', {
        user_ids: filters.userIds || null,
        job_statuses: filters.jobStatuses || null,
        search_term: filters.search || null,
      });

      if (error) {
        log.error('[usePipelineGlobalMetrics] Error:', error);
        throw error;
      }

      log.debug('[usePipelineGlobalMetrics] Result:', data);
      return data as unknown as PipelineGlobalMetrics;
    },
    staleTime: 30000, // 30s
  });
}
