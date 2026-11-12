// interview_transcripts rows (Interview notes, step 3, 2026-11-12): one per interview,
// written by process-transcript-webhook when the note-taker's email arrives and by
// generate-scorecard-from-transcript as it fetches the full transcript and drafts.

import {
  PROBLEM_REASON,
  fetchFirefliesTranscript,
  transcriptText,
  type FetchResult,
  type Sentence,
} from './fireflies.ts'
import type { CleanedSource, SourceKind } from './interviewNotes.ts'

export type TranscriptSource = 'fireflies_api' | 'fireflies_recap' | 'read_ai' | 'email'
export type TranscriptStatus = 'received' | 'fetching' | 'ready' | 'drafting' | 'drafted' | 'nothing_said' | 'failed'

export interface TranscriptRow {
  booking_id: string
  tenant_id: string | null
  source: TranscriptSource
  external_id: string | null
  language: string | null
  duration_seconds: number | null
  speakers: { id: string; name: string }[]
  sentences: Sentence[]
  provider_summary: Record<string, unknown> | null
  status: TranscriptStatus
  status_reason: string | null
  fetched_at: string | null
}

/** Readable reasons the screens show (never a server's own text). */
export const REASON = {
  noLink: "The recap email had no link to the meeting, so the notes use Fireflies' summary.",
  noKey: "Gio isn't connected to Fireflies, so the notes use its summary.",
  noContext: "This interview isn't linked to a job stage, so Gio kept the transcript but wrote no notes.",
  failed: "Gio couldn't write the notes. Try again.",
} as const

/** Where a cleaned email came from, as the table records it. */
export function sourceFor(cleaned: Pick<CleanedSource, 'provider'>): TranscriptSource {
  if (cleaned.provider === 'fireflies') return 'fireflies_recap'
  if (cleaned.provider === 'read_ai') return 'read_ai'
  return 'email'
}

// The client is the service-role supabase-js client; only the calls used here.
// deno-lint-ignore no-explicit-any
type Db = any

const now = () => new Date().toISOString()

/**
 * The email is in: record it. A new email for the same meeting keeps a transcript
 * already fetched; one for a different meeting (another Fireflies id) starts over.
 */
export async function recordReceived(
  db: Db,
  booking: { id: string; tenant_id?: string | null },
  cleaned: Pick<CleanedSource, 'provider' | 'firefliesId'>,
): Promise<void> {
  const { data: existing } = await db
    .from('interview_transcripts')
    .select('external_id, source')
    .eq('booking_id', booking.id)
    .maybeSingle()
  const externalId = cleaned.firefliesId ?? null
  const sameMeeting = !!existing && !!externalId && existing.external_id === externalId
  const keepFetched = sameMeeting && existing.source === 'fireflies_api'
  const row: Record<string, unknown> = {
    booking_id: booking.id,
    tenant_id: booking.tenant_id ?? null,
    external_id: externalId,
    status: 'received',
    status_reason: null,
    status_at: now(),
  }
  if (!keepFetched) {
    Object.assign(row, {
      source: sourceFor(cleaned),
      speakers: [],
      sentences: [],
      duration_seconds: null,
      provider_summary: null,
      fetched_at: null,
      language: null,
    })
  }
  const { error } = await db.from('interview_transcripts').upsert(row, { onConflict: 'booking_id' })
  if (error) console.error('[interview_transcripts] record received failed:', error.message)
}

export async function setStatus(
  db: Db,
  bookingId: string,
  status: TranscriptStatus,
  reason: string | null = null,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db
    .from('interview_transcripts')
    .update({ status, status_reason: reason, status_at: now(), ...extra })
    .eq('booking_id', bookingId)
  if (error) console.error('[interview_transcripts] status', status, 'failed:', error.message)
}

export interface SourceForNotes {
  text: string
  kind: SourceKind
  /** Came from Fireflies' API: speakers and times in every line. */
  full: boolean
  /** Why the full transcript isn't there, when it isn't. */
  reason: string | null
}

interface EnsureOptions {
  apiKey: string | null | undefined
  fetchImpl?: typeof fetch
  /** Waits before asking again while Fireflies is still processing (ms). */
  retryAfter?: number[]
  sleep?: (ms: number) => Promise<void>
}

/**
 * The text Gio writes the notes from. For a Fireflies meeting, the full transcript
 * from its API (fetched once, then read from the row); when that can't be had, the
 * recap's summary with a readable reason. Anything else is the email as it came.
 */
export async function sourceForNotes(
  db: Db,
  booking: { id: string; tenant_id?: string | null },
  fallback: { text: string; kind: SourceKind; provider: CleanedSource['provider']; firefliesId: string | null },
  opts: EnsureOptions,
): Promise<SourceForNotes> {
  const { data: found } = await db
    .from('interview_transcripts')
    .select('*')
    .eq('booking_id', booking.id)
    .maybeSingle()
  let row = found as TranscriptRow | null
  if (!row) {
    // An older booking whose email came before this table: start its row now.
    await recordReceived(db, booking, fallback)
    row = {
      source: sourceFor(fallback),
      external_id: fallback.firefliesId,
      sentences: [],
    } as unknown as TranscriptRow
  }

  if (row.source === 'fireflies_api' && Array.isArray(row.sentences) && row.sentences.length) {
    return { text: transcriptText(row.sentences), kind: 'transcript', full: true, reason: null }
  }

  const externalId = row.external_id ?? fallback.firefliesId
  if (fallback.provider !== 'fireflies' && row.source !== 'fireflies_recap') {
    await setStatus(db, booking.id, 'ready')
    return { text: fallback.text, kind: fallback.kind, full: false, reason: null }
  }
  if (!externalId) {
    await setStatus(db, booking.id, 'ready', REASON.noLink)
    return { text: fallback.text, kind: fallback.kind, full: false, reason: REASON.noLink }
  }
  if (!opts.apiKey) {
    await setStatus(db, booking.id, 'ready', REASON.noKey)
    return { text: fallback.text, kind: fallback.kind, full: false, reason: REASON.noKey }
  }

  await setStatus(db, booking.id, 'fetching')
  const waits = opts.retryAfter ?? [12000]
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let result: FetchResult = await fetchFirefliesTranscript(externalId, opts.apiKey, opts.fetchImpl)
  for (const ms of waits) {
    if (result.ok || (result.problem !== 'not_ready' && result.problem !== 'error')) break
    await sleep(ms)
    result = await fetchFirefliesTranscript(externalId, opts.apiKey, opts.fetchImpl)
  }

  if (!result.ok) {
    console.warn('[interview_transcripts] Fireflies fetch for', externalId, 'failed:', result.problem)
    const reason = PROBLEM_REASON[result.problem]
    await setStatus(db, booking.id, 'ready', reason, { source: 'fireflies_recap', external_id: externalId })
    return { text: fallback.text, kind: fallback.kind, full: false, reason }
  }

  const t = result.transcript
  await setStatus(db, booking.id, 'ready', null, {
    source: 'fireflies_api',
    external_id: externalId,
    speakers: t.speakers,
    sentences: t.sentences,
    duration_seconds: t.durationSeconds,
    provider_summary: t.summary,
    fetched_at: now(),
  })
  return { text: transcriptText(t.sentences), kind: 'transcript', full: true, reason: null }
}
