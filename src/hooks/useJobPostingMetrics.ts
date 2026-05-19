import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface PostingMetric {
  applications: number
  views: number
  applyRate: number
  newThisWeek: number
}

export type PostingMetricsMap = Record<string, PostingMetric>

/**
 * v1 metrics: distinct candidate applications per posting derived from
 * candidate_application_responses (one row per field; we group by candidate_id).
 * Views are not tracked yet — returned as 0 until a job_posting_views table lands.
 */
export function useJobPostingMetrics(jobId: string, postingIds: string[]) {
  const [metrics, setMetrics] = useState<PostingMetricsMap>({})
  const [isLoading, setIsLoading] = useState(false)

  const key = postingIds.slice().sort().join(',')

  useEffect(() => {
    if (!jobId || postingIds.length === 0) {
      setMetrics({})
      return
    }
    let cancelled = false
    setIsLoading(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('candidate_application_responses')
        .select('candidate_id, posting_id, created_at')
        .eq('job_id', jobId)
        .in('posting_id', postingIds)

      if (cancelled) return
      const out: PostingMetricsMap = {}
      for (const pid of postingIds) {
        out[pid] = { applications: 0, views: 0, applyRate: 0, newThisWeek: 0 }
      }
      if (!error && data) {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const seen: Record<string, Set<string>> = {}
        const seenWeek: Record<string, Set<string>> = {}
        for (const row of data as Array<{ candidate_id: string | null; posting_id: string | null; created_at: string }>) {
          if (!row.posting_id || !row.candidate_id) continue
          if (!seen[row.posting_id]) seen[row.posting_id] = new Set()
          seen[row.posting_id].add(row.candidate_id)
          if (new Date(row.created_at).getTime() >= weekAgo) {
            if (!seenWeek[row.posting_id]) seenWeek[row.posting_id] = new Set()
            seenWeek[row.posting_id].add(row.candidate_id)
          }
        }
        for (const pid of postingIds) {
          const apps = seen[pid]?.size || 0
          out[pid].applications = apps
          out[pid].newThisWeek = seenWeek[pid]?.size || 0
          // applyRate computed in UI once we have views
        }
      }
      setMetrics(out)
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, key])

  return { metrics, isLoading }
}
