import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

/**
 * A job's screening rules and team notifications (job_settings, 2026-10-19).
 * The database makes the row with the job and carries every switch out:
 * screening on application (jca_z_application), the Gio Fit bar (jca_z_score_bar),
 * batched application and stage-move notifications. One shared query per job
 * (['job-settings', jobId]); a change shows at once and rolls back on failure.
 */
export interface JobSettings {
  job_id: string
  reject_outside_countries: boolean
  hiring_countries: string[]
  reject_salary_above: boolean
  salary_margin_pct: number
  auto_score: boolean
  auto_reject_below: boolean
  auto_reject_threshold: number
  ai_summary: boolean
  reject_template_id: string | null
  notify_applications: boolean
  notify_stage_moves: boolean
  daily_digest: boolean
  updated_at: string
  updated_by: string | null
}

export type JobSettingsPatch = Partial<Omit<JobSettings, 'job_id' | 'updated_at' | 'updated_by'>>

const key = (jobId: string | null | undefined) => ['job-settings', jobId] as const

export function useJobSettings(jobId: string | null | undefined) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: key(jobId),
    enabled: !!jobId,
    queryFn: async (): Promise<JobSettings | null> => {
      const { data, error } = await (supabase.from('job_settings' as any) as any)
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle()
      if (error) throw error
      return (data as JobSettings | null) ?? null
    },
  })

  const mutation = useMutation({
    mutationFn: async (patch: JobSettingsPatch) => {
      const { data, error } = await (supabase.from('job_settings' as any) as any)
        .update(patch)
        .eq('job_id', jobId)
        .select('*')
        .single()
      if (error) throw error
      return data as JobSettings
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key(jobId) })
      const previous = qc.getQueryData<JobSettings | null>(key(jobId))
      if (previous) qc.setQueryData(key(jobId), { ...previous, ...patch })
      return { previous }
    },
    onError: (_err, patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(key(jobId), ctx.previous)
      toast({
        title: 'Couldn’t save that setting',
        description: 'It’s back as it was; try again.',
        variant: 'destructive',
        action: { label: 'Retry', onClick: () => mutation.mutate(patch) } as any,
      })
    },
    onSuccess: (data) => qc.setQueryData(key(jobId), data),
  })

  const update = useCallback((patch: JobSettingsPatch) => {
    if (jobId) mutation.mutate(patch)
  }, [jobId, mutation])

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    loadError: query.error as Error | null,
    refetch: query.refetch,
    update,
    isSaving: mutation.isPending,
  }
}
