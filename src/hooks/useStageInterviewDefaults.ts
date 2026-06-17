import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { InterviewDurationMinutes, InterviewFormat } from './useStageConfiguration'

export interface StageInterviewDefaults {
  interviewDurationMinutes: InterviewDurationMinutes | null
  interviewFormat: InterviewFormat | null
  slaEnabled: boolean
  slaDays: number | null
  stageInstructions: string | null
}

/**
 * Lightweight read-only hook returning per-stage interview defaults.
 * Used by scheduling sheets and the scorecard "Interview Details" tab.
 */
export function useStageInterviewDefaults(jhsId: string | null | undefined) {
  return useQuery({
    queryKey: ['stage-interview-defaults', jhsId],
    enabled: !!jhsId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<StageInterviewDefaults | null> => {
      if (!jhsId) return null
      const { data, error } = await supabase
        .from('job_hiring_stages')
        .select('interview_duration_minutes, interview_format, sla_enabled, sla_days, stage_instructions')
        .eq('id', jhsId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const row: any = data
      return {
        interviewDurationMinutes: row.interview_duration_minutes ?? null,
        interviewFormat: row.interview_format ?? null,
        slaEnabled: !!row.sla_enabled,
        slaDays: row.sla_days ?? null,
        stageInstructions: row.stage_instructions ?? null,
      }
    },
  })
}
