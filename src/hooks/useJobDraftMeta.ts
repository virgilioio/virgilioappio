import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const db = supabase as any

export interface JobSetupChecks {
  job_info: boolean
  openings: boolean
  hiring_plan: boolean
  hiring_team: boolean
  attribution: boolean
  missing: string[]
}

export const SETUP_SEGMENTS: Array<{ key: keyof Omit<JobSetupChecks, 'missing'>; label: string }> = [
  { key: 'job_info', label: 'Job info' },
  { key: 'openings', label: 'Openings' },
  { key: 'hiring_plan', label: 'Hiring plan' },
  { key: 'hiring_team', label: 'Hiring team' },
  { key: 'attribution', label: 'Attribution' },
]

/** Setup checks (database job_setup_checks) + live openings count for each draft job. */
export function useJobDraftMeta(jobIds: string[]) {
  const key = [...jobIds].sort().join(',')
  return useQuery({
    queryKey: ['job-draft-meta', key],
    enabled: jobIds.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const [checks, openings] = await Promise.all([
        Promise.all(
          jobIds.map(async (id) => {
            const { data } = await db.rpc('job_setup_checks', { p_job: id })
            return [id, (data as JobSetupChecks) ?? null] as const
          }),
        ),
        db.from('job_openings').select('job_id').in('job_id', jobIds).is('cancelled_at', null),
      ])
      const openingCounts: Record<string, number> = {}
      for (const r of openings.data || []) openingCounts[r.job_id] = (openingCounts[r.job_id] || 0) + 1
      return { checks: Object.fromEntries(checks) as Record<string, JobSetupChecks | null>, openingCounts }
    },
  })
}

/** Single job's setup checks — used by Job setup / publish UI. */
export function useJobSetupChecks(jobId?: string | null) {
  return useQuery({
    queryKey: ['job-setup-checks', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await db.rpc('job_setup_checks', { p_job: jobId })
      if (error) throw error
      return data as JobSetupChecks | null
    },
  })
}
