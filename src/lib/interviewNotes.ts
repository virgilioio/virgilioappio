import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { ScoreRating } from '@/hooks/useScorecards'
import { coerceRating } from '@/lib/scorecardRatings'

/**
 * Interview notes, step 5 (2026-11-12): what the scorecard sheet shows about Gio's
 * notes on an interview. Gio's recommendation (job_stage_scorecards.ai_recommendation,
 * written by generate-scorecard-from-transcript through `settleRecommendation`), where
 * the notes got to (interview_transcripts.status, live), the transcript itself, and
 * Retry (`interview_notes_retry`).
 */

// -- The recommendation ----------------------------------------------------------------

export type Verdict = 'met' | 'partly' | 'not_met' | 'not_discussed'
export type CriterionKind = 'must' | 'nice' | 'years' | 'location' | 'salary' | 'question'
export type Confidence = 'high' | 'medium' | 'low'

export interface RecommendationCriterion {
  id: string
  kind: CriterionKind
  label: string
  verdict: Verdict
  evidence: string
  quote: string | null
  /** Seconds from the start of the call. */
  at: number | null
}

export interface Recommendation {
  rating: ScoreRating | null
  confidence: Confidence
  reason: string
  language: string | null
  sourceKind: 'summary' | 'transcript'
  criteria: RecommendationCriterion[]
}

const VERDICTS: Verdict[] = ['met', 'partly', 'not_met', 'not_discussed']
const KINDS: CriterionKind[] = ['must', 'nice', 'years', 'location', 'salary', 'question']

/** The stored recommendation, read defensively (older drafts have none). */
export function parseRecommendation(raw: unknown): Recommendation | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const criteria = (Array.isArray(r.criteria) ? r.criteria : [])
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c, i) => ({
      id: String(c.id ?? `c${i + 1}`),
      kind: (KINDS.includes(c.kind as CriterionKind) ? c.kind : 'nice') as CriterionKind,
      label: String(c.label ?? '').trim(),
      verdict: (VERDICTS.includes(c.verdict as Verdict) ? c.verdict : 'not_discussed') as Verdict,
      evidence: String(c.evidence ?? '').trim(),
      quote: typeof c.quote === 'string' && c.quote.trim() ? c.quote.trim() : null,
      at: typeof c.at === 'number' && Number.isFinite(c.at) && c.at >= 0 ? c.at : null,
    }))
    .filter((c) => c.label)
  const confidence = r.confidence === 'high' || r.confidence === 'medium' ? r.confidence : 'low'
  return {
    rating: coerceRating(typeof r.rating === 'string' ? r.rating : null),
    confidence,
    reason: String(r.reason ?? '').trim(),
    language: typeof r.language === 'string' ? r.language : null,
    sourceKind: r.source_kind === 'summary' ? 'summary' : 'transcript',
    criteria,
  }
}

/** Requirements in the order a reader weighs them: must-haves first, the rest after. */
export function orderCriteria(list: RecommendationCriterion[]): RecommendationCriterion[] {
  const rank: Record<CriterionKind, number> = { must: 0, years: 1, location: 2, salary: 3, nice: 4, question: 5 }
  return [...list].sort((a, b) => rank[a.kind] - rank[b.kind])
}

export function verdictCounts(list: RecommendationCriterion[]) {
  const out: Record<Verdict, number> = { met: 0, partly: 0, not_met: 0, not_discussed: 0 }
  for (const c of list) out[c.verdict]++
  return out
}

/** "12:05" for 725 seconds; "1:02:05" past the hour. */
export function clock(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${h ? `${h}:` : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`
}

/** "42 min" / "1 h 05 min". */
export function callLength(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`
}

// -- Where the notes got to ------------------------------------------------------------

export type TranscriptStatus = 'received' | 'fetching' | 'ready' | 'drafting' | 'drafted' | 'nothing_said' | 'failed'

export interface NotesStatusRow {
  booking_id: string
  status: TranscriptStatus
  status_reason: string | null
  status_at: string
  source: 'fireflies_api' | 'fireflies_recap' | 'read_ai' | 'email'
  external_id: string | null
  language: string | null
  duration_seconds: number | null
}

export type NotesStatusTone = 'working' | 'done' | 'note' | 'problem'

export interface NotesStatusView {
  tone: NotesStatusTone
  text: string
  /** Offer Retry ("Try again" when the notes exist but could be better). */
  retry: 'Retry' | 'Try again' | null
}

/** A run that hasn't moved for this long has stopped (the server says the same). */
export const STUCK_AFTER_MS = 10 * 60 * 1000

/**
 * What the status line says. `submitted`: the interviewer's scorecard is in, so a run
 * would change nothing and Retry isn't offered.
 */
export function notesStatusView(row: NotesStatusRow | null | undefined, opts: { submitted: boolean; now?: number }): NotesStatusView | null {
  if (!row) return null
  const now = opts.now ?? Date.now()
  const stuck = now - new Date(row.status_at).getTime() > STUCK_AFTER_MS
  const canRetry = !opts.submitted
  switch (row.status) {
    case 'received':
    case 'fetching':
    case 'ready':
    case 'drafting':
      if (stuck) return { tone: 'problem', text: "Gio couldn't finish the notes.", retry: canRetry ? 'Retry' : null }
      return {
        tone: 'working',
        text: row.status === 'drafting' ? 'Gio is writing the notes…' : 'Gio is reading the interview…',
        retry: null,
      }
    case 'drafted':
      if (row.source !== 'fireflies_api' && row.status_reason) {
        return { tone: 'note', text: row.status_reason, retry: canRetry ? 'Try again' : null }
      }
      return {
        tone: 'done',
        text: row.source === 'fireflies_api' ? 'Gio drafted the notes from the full transcript.' : 'Gio drafted the notes from the interview.',
        retry: null,
      }
    case 'nothing_said':
      return { tone: 'note', text: 'Nothing was said in this call that Gio could write notes from.', retry: canRetry ? 'Try again' : null }
    case 'failed':
      // The stored reason may end in its own "Try again."; the Retry beside it says that.
      return {
        tone: 'problem',
        text: (row.status_reason || '').replace(/\s*Try again\.?$/i, '').trim() || "Gio couldn't write the notes.",
        retry: canRetry ? 'Retry' : null,
      }
    default:
      return null
  }
}

/** Fireflies' own page for a meeting. */
export function firefliesUrl(externalId: string | null | undefined): string | null {
  return externalId && /^[A-Za-z0-9]{10,40}$/.test(externalId) ? `https://app.fireflies.ai/view/${externalId}` : null
}

// -- Queries ---------------------------------------------------------------------------

const STATUS_COLUMNS = 'booking_id, status, status_reason, status_at, source, external_id, language, duration_seconds'

/**
 * The interview a scorecard is about: the draft's own booking, else the latest
 * interview at this stage with this interviewer.
 */
export function useScorecardInterview(opts: {
  bookingId?: string | null
  associationId?: string | null
  stageInstanceId?: string | null
  interviewerId?: string | null
  enabled?: boolean
}) {
  const { bookingId, associationId, stageInstanceId, interviewerId, enabled = true } = opts
  return useQuery({
    queryKey: ['scorecard-interview', bookingId ?? null, associationId ?? null, stageInstanceId ?? null, interviewerId ?? null],
    enabled: enabled && (!!bookingId || (!!associationId && !!stageInstanceId && !!interviewerId)),
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      if (bookingId) return bookingId
      const { data, error } = await supabase
        .from('scheduled_bookings')
        .select('id')
        .eq('job_candidate_association_id', associationId!)
        .eq('job_hiring_stage_id', stageInstanceId!)
        .eq('interviewer_id', interviewerId!)
        .order('scheduled_start', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data?.id ?? null
    },
  })
}

export const notesStatusKey = (bookingId: string | null | undefined) => ['interview-notes-status', bookingId ?? null] as const
export const transcriptKey = (bookingId: string | null | undefined) => ['interview-transcript', bookingId ?? null] as const

/** Where Gio's notes on an interview got to, kept live over Realtime. */
export function useInterviewNotesStatus(bookingId: string | null | undefined) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: notesStatusKey(bookingId),
    enabled: !!bookingId,
    queryFn: async (): Promise<NotesStatusRow | null> => {
      const { data, error } = await supabase
        .from('interview_transcripts')
        .select(STATUS_COLUMNS)
        .eq('booking_id', bookingId!)
        .maybeSingle()
      if (error) throw error
      return (data as NotesStatusRow | null) ?? null
    },
    // While Gio works, look again now and then in case a Realtime message is missed.
    refetchInterval: (q) => {
      const s = (q.state.data as NotesStatusRow | null | undefined)?.status
      return s && ['received', 'fetching', 'ready', 'drafting'].includes(s) ? 15_000 : false
    },
  })
  useEffect(() => {
    if (!bookingId) return
    const channel = supabase
      .channel(`interview-notes-${bookingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'interview_transcripts', filter: `booking_id=eq.${bookingId}` },
        () => {
          void qc.invalidateQueries({ queryKey: notesStatusKey(bookingId) })
          void qc.invalidateQueries({ queryKey: transcriptKey(bookingId) })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [bookingId, qc])
  return query
}

export interface TranscriptSentence {
  i: number
  speaker: string
  text: string
  start: number
  end: number
}

export interface TranscriptTurn {
  speaker: string
  start: number
  text: string
}

export interface InterviewTranscript {
  source: NotesStatusRow['source']
  externalId: string | null
  language: string | null
  durationSeconds: number | null
  speakers: string[]
  turns: TranscriptTurn[]
}

/** A speaker's consecutive sentences as one turn, as the notes quote them. */
export function transcriptTurns(sentences: unknown): TranscriptTurn[] {
  const list = (Array.isArray(sentences) ? sentences : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      speaker: String(s.speaker ?? '').trim() || 'Speaker',
      text: String(s.text ?? '').trim(),
      start: typeof s.start === 'number' && Number.isFinite(s.start) ? s.start : 0,
    }))
    .filter((s) => s.text)
    .sort((a, b) => a.start - b.start)
  const turns: TranscriptTurn[] = []
  for (const s of list) {
    const last = turns[turns.length - 1]
    if (last && last.speaker === s.speaker) last.text += ` ${s.text}`
    else turns.push({ ...s })
  }
  return turns
}

/** The turn a moment in the call belongs to: the last one that started by then. */
export function turnAt(turns: TranscriptTurn[], seconds: number): number {
  let hit = -1
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].start <= seconds + 0.5) hit = i
    else break
  }
  return Math.max(0, hit)
}

/** The whole conversation, loaded only when the Transcript tab opens. */
export function useInterviewTranscript(bookingId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: transcriptKey(bookingId),
    enabled: enabled && !!bookingId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<InterviewTranscript | null> => {
      const { data, error } = await supabase
        .from('interview_transcripts')
        .select('source, external_id, language, duration_seconds, speakers, sentences')
        .eq('booking_id', bookingId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const turns = transcriptTurns(data.sentences)
      const named = (Array.isArray(data.speakers) ? data.speakers : [])
        .map((s) => String((s as { name?: unknown } | null)?.name ?? '').trim())
        .filter(Boolean)
      const speakers = [...new Set([...named, ...turns.map((t) => t.speaker)])]
      return {
        source: data.source as NotesStatusRow['source'],
        externalId: data.external_id,
        language: data.language,
        durationSeconds: data.duration_seconds,
        speakers,
        turns,
      }
    },
  })
}

/** Gio's draft for an interview as it is now (after a Retry rewrote it). */
export async function fetchInterviewDraft(bookingId: string, interviewerId: string) {
  const { data, error } = await supabase
    .from('job_stage_scorecards')
    .select('id, general_overview, ai_suggested_rating, ai_recommendation, updated_at')
    .eq('source_booking_id', bookingId)
    .eq('created_by', interviewerId)
    .eq('is_ai_draft', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// -- Retry -----------------------------------------------------------------------------

const RETRY_ERRORS: Record<string, string> = {
  GIN01: "You can't ask Gio to redo the notes for this interview.",
  GIN02: 'Your scorecard for this interview is already submitted.',
  GIN03: 'Gio is already working on these notes.',
}

export class RetryError extends Error {}

/** Ask Gio to write the notes again. Throws a RetryError with a readable message. */
export async function retryInterviewNotes(bookingId: string): Promise<void> {
  // Not in the generated types until the migration is applied and they're regenerated.
  const rpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>
  const { error } = await rpc.call(supabase, 'interview_notes_retry', { p_booking: bookingId })
  if (error) throw new RetryError(RETRY_ERRORS[error.code as string] ?? "Couldn't ask Gio to redo the notes.")
}
