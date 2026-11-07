import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

/**
 * Who on a job is waiting for Gio Fit (2026-11-08): the Match column, the list view
 * and the board cards show a re-score in progress (`GioFitScore`). One provider per
 * job page reads `fit_queue_job_status` every 15s while anyone is queued (60s
 * otherwise, and at once after a bulk re-score or a job save: the `gio:fit-queue`
 * event). When someone leaves the queue their new score is in: `onScored` refreshes
 * the pipeline and the cell flashes once.
 */
export const FIT_QUEUE_EVENT = 'gio:fit-queue'

export interface FitQueueEntry {
  /** Due now: in line or being scored. Otherwise waiting out a job change's 10 minutes. */
  due: boolean
  dueAt: string
}

interface FitQueueValue {
  queued: Map<string, FitQueueEntry>
  /** Scored in the last moment: their cell flashes once. */
  justScored: Set<string>
}

const EMPTY: FitQueueValue = { queued: new Map(), justScored: new Set() }
const FitQueueContext = createContext<FitQueueValue>(EMPTY)

/** Tell the job page to look at the queue now (after a bulk re-score or a job save). */
export function announceFitQueueChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FIT_QUEUE_EVENT))
}

export function FitQueueProvider({ jobId, onScored, children }: { jobId: string | undefined; onScored?: () => void; children: ReactNode }) {
  const query = useQuery({
    queryKey: ['fit-queue-status', jobId],
    enabled: !!jobId,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => ((q.state.data as unknown[] | undefined)?.length ? 15_000 : 60_000),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fit_queue_job_status', { p_job_id: jobId! })
      if (error) throw error
      return (data ?? []) as { association_id: string; due_at: string; due: boolean }[]
    },
  })
  const { refetch } = query

  useEffect(() => {
    const now = () => void refetch()
    window.addEventListener(FIT_QUEUE_EVENT, now)
    return () => window.removeEventListener(FIT_QUEUE_EVENT, now)
  }, [refetch])

  const queued = useMemo(() => {
    const m = new Map<string, FitQueueEntry>()
    for (const r of query.data ?? []) m.set(r.association_id, { due: r.due, dueAt: r.due_at })
    return m
  }, [query.data])

  // Someone who was queued and isn't any more has a new score.
  const previous = useRef<Set<string> | null>(null)
  const onScoredRef = useRef(onScored)
  onScoredRef.current = onScored
  const [justScored, setJustScored] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!query.data) return
    const ids = new Set(queued.keys())
    const before = previous.current
    previous.current = ids
    if (!before) return
    const done = [...before].filter((id) => !ids.has(id))
    if (!done.length) return
    onScoredRef.current?.()
    setJustScored(new Set(done))
    const t = window.setTimeout(() => setJustScored(new Set()), 1600)
    return () => window.clearTimeout(t)
  }, [queued, query.data])

  const value = useMemo(() => ({ queued, justScored }), [queued, justScored])
  return <FitQueueContext.Provider value={value}>{children}</FitQueueContext.Provider>
}

/** This candidate's place in the Gio Fit queue on the current job, if any. */
export function useFitQueueEntry(associationId: string | null | undefined) {
  const { queued, justScored } = useContext(FitQueueContext)
  if (!associationId) return { entry: undefined, justScored: false }
  return { entry: queued.get(associationId), justScored: justScored.has(associationId) }
}

/** "Re-scoring in about 6 minutes" for one waiting out a job change. */
export function minutesUntil(iso: string): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000))
}
