import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export const AGING_BUCKETS = ['0–7d', '8–14d', '15–30d', '30d+'] as const
export const bucketOf = (d: number) => (d <= 7 ? 0 : d <= 14 ? 1 : d <= 30 ? 2 : 3)

export interface AgingCandidate {
  associationId: string
  candidateId: string
  jobId: string
  name: string
  job: string
  stage: string
  stagePosition: number
  recruiter: string
  daysInStage: number
  daysInPipeline: number
  estimated: boolean
}

export interface PipelineAgingData {
  candidates: AgingCandidate[]
  isLoading: boolean
}

const DAY = 86_400_000
const INACTIVE = new Set(['rejected', 'hired', 'withdrawn'])

async function chunked<T>(ids: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 200) out.push(...(await fn(ids.slice(i, i + 200))))
  return out
}

/**
 * Snapshot of active candidates (not rejected/hired/withdrawn) and how long they've sat
 * in their current stage. Stage entry = latest of entered_stage_at / last stage move;
 * falls back to the date added to the job (flagged as estimated). Ignores the date range.
 */
export function usePipelineAgingMetrics(finalJobIds: string[], enabled: boolean): PipelineAgingData {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-aging', finalJobIds.join(',')],
    enabled: enabled && finalJobIds.length > 0,
    queryFn: async (): Promise<AgingCandidate[]> => {
      const [jobsRes, assocs] = await Promise.all([
        supabase.from('jobs').select('id, title').in('id', finalJobIds),
        chunked(finalJobIds, async c => {
          const { data, error } = await supabase
            .from('job_candidate_associations')
            .select('id, candidate_id, job_id, status, current_stage_id, entered_stage_at, created_at, added_by')
            .in('job_id', c)
          if (error) throw error
          return data || []
        }),
      ])
      if (jobsRes.error) throw jobsRes.error
      const active = assocs.filter(a => !INACTIVE.has(String(a.status || 'active')))
      if (!active.length) return []

      const stageIds = [...new Set(active.map(a => a.current_stage_id).filter(Boolean) as string[])]
      const candIds = [...new Set(active.map(a => a.candidate_id))]
      const userIds = [...new Set(active.map(a => a.added_by).filter(Boolean) as string[])]
      const [stages, history, cands, profs] = await Promise.all([
        chunked(stageIds, async c => {
          const { data } = await (supabase as any).from('job_hiring_stages').select('id, position, custom_stage_name, job_stages(stage_name)').in('id', c)
          return data || []
        }),
        chunked(active.map(a => a.id), async c => {
          const { data } = await supabase.from('job_candidate_stage_history').select('association_id, moved_at').in('association_id', c)
          return data || []
        }),
        chunked(candIds, async c => {
          const { data } = await (supabase as any).from('candidates').select('id, first_name, last_name').in('id', c)
          return data || []
        }),
        userIds.length
          ? chunked(userIds, async c => {
              const { data } = await (supabase as any).from('profiles').select('id, full_name, email').in('id', c)
              return data || []
            })
          : Promise.resolve([] as any[]),
      ])

      const stageMap = new Map<string, { name: string; position: number }>(
        stages.map((s: any) => [s.id, { name: s.custom_stage_name || s.job_stages?.stage_name || 'Unknown stage', position: s.position ?? 99 }]),
      )
      const lastMove = new Map<string, number>()
      for (const h of history as any[]) {
        const t = new Date(h.moved_at).getTime()
        if (!lastMove.has(h.association_id) || t > lastMove.get(h.association_id)!) lastMove.set(h.association_id, t)
      }
      const candName = new Map<string, string>(cands.map((c: any) => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed']))
      const userName = new Map<string, string>(profs.map((p: any) => [p.id, p.full_name || p.email || 'Unknown']))
      const jobTitle = new Map((jobsRes.data || []).map(j => [j.id, j.title]))
      const now = Date.now()

      return active.map(a => {
        const recorded = [a.entered_stage_at ? new Date(a.entered_stage_at).getTime() : null, lastMove.get(a.id) ?? null].filter(
          (x): x is number => x !== null,
        )
        const added = new Date(a.created_at).getTime()
        const entered = recorded.length ? Math.max(...recorded) : added
        const st = a.current_stage_id ? stageMap.get(a.current_stage_id) : undefined
        return {
          associationId: a.id,
          candidateId: a.candidate_id,
          jobId: a.job_id,
          name: candName.get(a.candidate_id) || 'Unnamed',
          job: jobTitle.get(a.job_id) || 'Unknown job',
          stage: st?.name || 'No stage',
          stagePosition: st?.position ?? 99,
          recruiter: (a.added_by && userName.get(a.added_by)) || 'Unassigned',
          daysInStage: Math.max(0, Math.floor((now - entered) / DAY)),
          daysInPipeline: Math.max(0, Math.floor((now - added) / DAY)),
          estimated: recorded.length === 0,
        }
      })
    },
  })
  return { candidates: data || [], isLoading: enabled && finalJobIds.length > 0 && isLoading }
}
