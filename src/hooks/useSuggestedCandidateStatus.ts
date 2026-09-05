import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export type SuggestedStatusKind = 'free' | 'pipeline' | 'contacted' | 'rejected'

export interface SuggestedStatus {
  kind: SuggestedStatusKind
  /** Secondary line — job · stage, job · month/year, "Emailed N days ago". */
  note?: string
}

const monthYear = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/**
 * Where a suggested person already is: another pipeline, rejected before, or
 * recently emailed. Read-only — this never writes anything.
 */
export function useSuggestedCandidateStatus(jobId: string | undefined, candidateIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, SuggestedStatus>>({})
  const key = candidateIds.slice().sort().join(',')

  useEffect(() => {
    let cancelled = false
    const ids = key ? key.split(',').filter(Boolean) : []
    if (!jobId || ids.length === 0) {
      setStatuses({})
      return
    }

    const load = async () => {
      const next: Record<string, SuggestedStatus> = {}

      const { data: assocs } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id, job_id, status, created_at, jobs(title)')
        .in('candidate_id', ids)
        .neq('job_id', jobId)
        .limit(500)

      ;(assocs || []).forEach((a: any) => {
        const title = a?.jobs?.title || 'another job'
        if (a.status === 'rejected') {
          const when = monthYear(a.created_at)
          next[a.candidate_id] = { kind: 'rejected', note: when ? `${title} · ${when}` : title }
        } else if (next[a.candidate_id]?.kind !== 'rejected') {
          next[a.candidate_id] = { kind: 'pipeline', note: title }
        }
      })

      const { data: emails } = await supabase
        .from('email_logs')
        .select('candidate_id, created_at, direction')
        .in('candidate_id', ids)
        .order('created_at', { ascending: false })
        .limit(500)

      ;(emails || []).forEach((e: any) => {
        if (!e.candidate_id || next[e.candidate_id]) return
        if (e.direction && e.direction !== 'outbound' && e.direction !== 'sent') return
        const days = Math.max(Math.round((Date.now() - new Date(e.created_at).getTime()) / 86400000), 0)
        next[e.candidate_id] = {
          kind: 'contacted',
          note: days === 0 ? 'Emailed today' : `Emailed ${days} day${days === 1 ? '' : 's'} ago`,
        }
      })

      if (!cancelled) setStatuses(next)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [jobId, key])

  return statuses
}
