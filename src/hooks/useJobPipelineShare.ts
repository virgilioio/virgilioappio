/**
 * The client pipeline share for one job. Created lazily; `is_public` starts false.
 * Every setter is optimistic and reverts on failure.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

export interface JobPipelineShare {
  id: string
  job_id: string
  token: string
  is_public: boolean
  from_stage_id: string | null
  show_fit_score: boolean
  show_days: boolean
  show_client_status: boolean
  show_employer: boolean
  initials_only: boolean
  client_can_respond: boolean
  show_scorecards: boolean
  view_count: number
  last_viewed_at: string | null
}

export type PipelineShareSettings = Partial<Omit<JobPipelineShare, 'id' | 'job_id' | 'token' | 'view_count' | 'last_viewed_at'>>

// The table is newer than the generated types.
const table = () => (supabase as any).from('job_pipeline_shares')

export function useJobPipelineShare(jobId: string | null | undefined, create = false) {
  const [share, setShare] = useState<JobPipelineShare | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!jobId) return
    setIsLoading(true)
    const { data } = await table().select('*').eq('job_id', jobId).maybeSingle()
    if (data) setShare(data)
    else if (create) {
      const { data: auth } = await supabase.auth.getUser()
      const { data: created } = await table().insert({ job_id: jobId, created_by: auth?.user?.id ?? null }).select('*').single()
      if (created) setShare(created)
    }
    setIsLoading(false)
  }, [jobId, create])

  useEffect(() => { void load() }, [load])

  const update = useCallback(async (patch: PipelineShareSettings) => {
    if (!share) return
    const previous = share
    setShare({ ...share, ...patch })
    const { data, error } = await table().update(patch).eq('id', share.id).select('*').single()
    if (error) {
      setShare(previous)
      toast({ title: 'Couldn’t save', description: 'The client view setting was not saved.', variant: 'destructive' })
      return
    }
    setShare(data)
  }, [share])

  const resetToken = useCallback(async () => {
    if (!share) return
    const { data, error } = await (supabase as any).rpc('reset_job_pipeline_share_token', { _share_id: share.id })
    if (error) {
      toast({ title: 'Couldn’t reset the link', variant: 'destructive' })
      return
    }
    setShare({ ...share, token: data as string, view_count: 0, last_viewed_at: null })
  }, [share])

  return { share, isLoading, update, resetToken, reload: load }
}

export const pipelinePublicUrl = (token: string) => `${window.location.origin}/cp/${token}`

/** Stage types that are never part of the client view. */
export const NON_RECRUITING_STAGE_TYPES = new Set(['application', 'application_review', 'offer', 'onboarding'])
