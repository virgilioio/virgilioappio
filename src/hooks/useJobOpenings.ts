import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { OpeningRow } from '@/lib/jobOpenings'

const db = supabase as any

export function useJobOpenings(jobId?: string | null) {
  const qc = useQueryClient()
  const key = ['job-openings', jobId]
  const q = useQuery<OpeningRow[]>({
    queryKey: key,
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await db
        .from('job_openings_with_status')
        .select('id, req_id, target_hire_date, target_start_date, status, candidate_name, position')
        .eq('job_id', jobId)
        .order('position')
        .order('created_at')
      if (error) throw error
      return (data || []).map((r: any) => ({ ...r, persisted: true }))
    },
  })
  return { openings: q.data || [], isLoading: q.isLoading, refetch: () => qc.invalidateQueries({ queryKey: key }) }
}

/** All Req IDs visible in the workspace — used to suggest the next number. */
export async function fetchWorkspaceReqIds(): Promise<string[]> {
  const { data } = await db.from('job_openings').select('req_id').limit(5000)
  return (data || []).map((r: any) => r.req_id)
}

/** Case-insensitive check across the workspace, excluding the given opening id. */
export async function isReqIdTaken(reqId: string, excludeId?: string): Promise<boolean> {
  const v = reqId.trim()
  if (!v) return false
  let q = db.from('job_openings').select('id').ilike('req_id', v.replace(/[%_]/g, '\\$&')).limit(1)
  if (excludeId && !excludeId.startsWith('tmp-')) q = q.neq('id', excludeId)
  const { data } = await q
  return (data || []).length > 0
}

export async function insertOpenings(jobId: string, rows: OpeningRow[]) {
  if (!rows.length) return
  const { error } = await db.from('job_openings').insert(
    rows.map((r, i) => ({
      job_id: jobId,
      req_id: r.req_id.trim().toUpperCase(),
      target_hire_date: r.target_hire_date,
      target_start_date: r.target_start_date,
      position: i,
    })),
  )
  if (error) throw error
}
