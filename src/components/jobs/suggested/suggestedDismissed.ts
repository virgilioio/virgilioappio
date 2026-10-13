import * as React from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/**
 * "Not a fit" on suggested candidates (2026-10-13). A dismissal belongs to the
 * job, not to one browser: it's a row in `job_suggestion_dismissals`, shared by
 * everyone who can see the job, and get-suggested-candidates leaves those
 * candidates out. Undo sets `undone_at`; dismissing again clears it. The
 * Suggested table and the suggested profile both go through here.
 */
export const dismissalsKey = (jobId: string) => ['suggestion-dismissals', jobId] as const

/** Before 2026-10-13 dismissals lived in localStorage under this key. */
const legacyKey = (jobId: string) => `gio.suggested.dismissed.${jobId}`

async function fetchDismissed(jobId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('job_suggestion_dismissals')
    .select('candidate_id')
    .eq('job_id', jobId)
    .is('undone_at', null)
  if (error) throw error
  return (data ?? []).map((r) => r.candidate_id as string)
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

/** Marks candidates Not a fit for this job. Throws if it couldn't be saved. */
export async function dismissSuggestions(jobId: string, candidateIds: string[], queryClient?: QueryClient) {
  if (!candidateIds.length) return
  const by = await currentUserId()
  const now = new Date().toISOString()
  for (let i = 0; i < candidateIds.length; i += 200) {
    const rows = candidateIds.slice(i, i + 200).map((candidate_id) => ({
      job_id: jobId,
      candidate_id,
      dismissed_by: by,
      dismissed_at: now,
      undone_at: null,
    }))
    const { error } = await supabase
      .from('job_suggestion_dismissals')
      .upsert(rows, { onConflict: 'job_id,candidate_id' })
    if (error) throw error
  }
  queryClient?.setQueryData<string[]>(dismissalsKey(jobId), (prev) => [...new Set([...(prev ?? []), ...candidateIds])])
}

/** Undo: the candidates can be suggested for this job again. */
export async function restoreSuggestions(jobId: string, candidateIds: string[], queryClient?: QueryClient) {
  if (!candidateIds.length) return
  for (let i = 0; i < candidateIds.length; i += 200) {
    const { error } = await supabase
      .from('job_suggestion_dismissals')
      .update({ undone_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .in('candidate_id', candidateIds.slice(i, i + 200))
      .is('undone_at', null)
    if (error) throw error
  }
  queryClient?.setQueryData<string[]>(dismissalsKey(jobId), (prev) => (prev ?? []).filter((id) => !candidateIds.includes(id)))
}

/**
 * One time per job: dismissals someone made before they were shared still sit
 * in this browser. Move them to the database, leaving out anyone who is in the
 * job's pipeline now (the old list also hid candidates who had been added).
 */
async function importLegacy(jobId: string, queryClient: QueryClient) {
  let ids: string[] = []
  try {
    const raw = localStorage.getItem(legacyKey(jobId))
    const parsed = raw ? JSON.parse(raw) : []
    ids = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return
  }
  if (!ids.length) return
  try {
    const { data, error } = await supabase
      .from('job_candidate_associations')
      .select('candidate_id')
      .eq('job_id', jobId)
      .in('candidate_id', ids.slice(0, 500))
    if (error) return
    const inPipeline = new Set((data ?? []).map((r) => r.candidate_id as string))
    await dismissSuggestions(jobId, ids.filter((id) => !inPipeline.has(id)).slice(0, 500), queryClient)
    localStorage.removeItem(legacyKey(jobId))
  } catch {
    /* try again next time the job opens */
  }
}

/** Candidate ids marked Not a fit for this job (shared). */
export function useSuggestionDismissals(jobId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: dismissalsKey(jobId),
    queryFn: () => fetchDismissed(jobId),
    enabled: !!jobId,
    staleTime: 30_000,
  })
  const imported = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!jobId || imported.current === jobId) return
    imported.current = jobId
    void importLegacy(jobId, queryClient)
  }, [jobId, queryClient])
  return { dismissedIds: query.data ?? [], isLoading: query.isLoading }
}
