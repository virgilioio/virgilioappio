import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/**
 * What happens after a new resume goes in (2026-10-17): the file uploads, Gio
 * re-reads it (enrich-candidate-profile), then re-scores Gio Fit on each job
 * the candidate is active in. One status the whole profile can show, so a
 * replace is visible wherever it was started (sidebar Files, Resume tab).
 */
/** 'other_person': the resume names someone else, so Gio left the profile as it was. */
export type ResumePhase = 'uploading' | 'reading' | 'scoring' | 'done' | 'unreadable' | 'other_person' | 'failed'

export interface ResumeRefreshStatus {
  phase: ResumePhase
  fileName: string
  /** Jobs Gio re-scores (active ones, at most 10, as the Edge Function does). */
  jobs: number
  /** Jobs re-scored so far. */
  scored: number
  /** Reading is taking longer than usual. */
  slow: boolean
}

const POLL_MS = 3000
const SLOW_MS = 90_000
const READ_LIMIT_MS = 5 * 60_000
const SCORE_LIMIT_MS = 5 * 60_000
const DONE_VISIBLE_MS = 8000
const MAX_RESCORED_JOBS = 10

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function readState(candidateId: string) {
  const { data } = await supabase
    .from('candidates')
    .select('enrichment_status, enriched_at')
    .eq('id', candidateId)
    .maybeSingle()
  return { status: (data?.enrichment_status as string | null) ?? null, enrichedAt: (data?.enriched_at as string | null) ?? null }
}

async function activeJobIds(candidateId: string): Promise<string[]> {
  const { data } = await supabase.from('job_candidate_associations').select('job_id, status').eq('candidate_id', candidateId)
  const ids = (data ?? [])
    .filter((a) => !['rejected', 'withdrawn'].includes(String(a.status ?? '').toLowerCase()))
    .map((a) => a.job_id as string)
  return [...new Set(ids)].slice(0, MAX_RESCORED_JOBS)
}

async function scoredSince(candidateId: string, since: string, jobIds: string[]): Promise<number> {
  if (!jobIds.length) return 0
  const { data } = await supabase
    .from('fit_score_history')
    .select('job_id')
    .eq('candidate_id', candidateId)
    .in('job_id', jobIds)
    .gte('created_at', since)
  return new Set((data ?? []).map((r) => r.job_id as string)).size
}

export function useResumeRefresh(
  candidateId: string | null | undefined,
  opts: { onProfileUpdated?: () => void; onScored?: () => void } = {},
) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ResumeRefreshStatus | null>(null)
  const runId = useRef(0)
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => () => { runId.current++ }, [])

  const run = useCallback(
    async (file: File, upload: () => Promise<unknown>) => {
      if (!candidateId) return
      const id = ++runId.current
      const alive = () => runId.current === id
      const base = { fileName: file.name, jobs: 0, scored: 0, slow: false }
      setStatus({ ...base, phase: 'uploading' })

      const before = await readState(candidateId)
      const startedAt = new Date().toISOString()
      try {
        await upload()
      } catch {
        if (alive()) setStatus({ ...base, phase: 'failed' })
        return
      }
      if (!alive()) return
      setStatus({ ...base, phase: 'reading' })

      // 1. Gio re-reads the resume.
      const t0 = Date.now()
      let state = before
      while (alive()) {
        await sleep(POLL_MS)
        if (!alive()) return
        state = await readState(candidateId)
        const reread = !!state.enrichedAt && state.enrichedAt !== before.enrichedAt
        if (reread || state.status === 'failed' || state.status === 'not_possible' || state.status === 'other_person') break
        if (Date.now() - t0 > READ_LIMIT_MS) break
        if (Date.now() - t0 > SLOW_MS) setStatus((s) => (s && s.phase === 'reading' ? { ...s, slow: true } : s))
      }
      if (!alive()) return
      if (state.status === 'other_person') {
        setStatus({ ...base, phase: 'other_person' })
        return
      }
      if (state.status === 'failed' || state.status === 'not_possible') {
        setStatus({ ...base, phase: 'unreadable' })
        return
      }
      if (!state.enrichedAt || state.enrichedAt === before.enrichedAt) {
        // Still reading after the limit: leave it to finish on its own.
        setStatus({ ...base, phase: 'reading', slow: true })
        return
      }
      // Experience and education are written right after the profile.
      await sleep(1500)
      if (!alive()) return
      for (const key of ['independent-candidate', 'independent-candidates', 'candidate-attachments', 'candidate']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      optsRef.current.onProfileUpdated?.()

      // 2. Gio Fit is re-scored job by job.
      const jobIds = await activeJobIds(candidateId)
      if (!alive()) return
      if (!jobIds.length) {
        setStatus({ ...base, phase: 'done' })
      } else {
        setStatus({ ...base, jobs: jobIds.length, phase: 'scoring' })
        const t1 = Date.now()
        let scored = 0
        while (alive() && scored < jobIds.length && Date.now() - t1 < SCORE_LIMIT_MS) {
          await sleep(POLL_MS)
          if (!alive()) return
          const next = await scoredSince(candidateId, startedAt, jobIds)
          if (next !== scored) {
            scored = next
            setStatus({ ...base, jobs: jobIds.length, scored, phase: 'scoring' })
          }
        }
        if (!alive()) return
        for (const key of ['candidate-fit', 'candidate-fit-insights', 'fit-score', 'fit-score-history']) {
          void queryClient.invalidateQueries({ queryKey: [key] })
        }
        optsRef.current.onScored?.()
        setStatus({ ...base, jobs: jobIds.length, scored, phase: 'done' })
      }
      await sleep(DONE_VISIBLE_MS)
      if (alive()) setStatus(null)
    },
    [candidateId, queryClient],
  )

  const clear = useCallback(() => {
    runId.current++
    setStatus(null)
  }, [])

  const busy = !!status && (status.phase === 'uploading' || status.phase === 'reading' || status.phase === 'scoring')
  return { status, busy, run, clear }
}
