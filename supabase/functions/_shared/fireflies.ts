// Fireflies' API (Interview notes, step 3, 2026-11-12): the full transcript of an
// interview, by the transcript id the recap email links to. Gio uses the API key of
// Virgilio's own Fireflies account (FIREFLIES_API_KEY, an Edge Function secret).
//
// GraphQL at https://api.fireflies.ai/graphql with "Authorization: Bearer <key>".
// Sentence times are seconds; the call's length is taken from the last sentence
// (Fireflies documents `duration` in minutes, other sources say seconds).

export const FIREFLIES_ENDPOINT = 'https://api.fireflies.ai/graphql'

export const FIREFLIES_TRANSCRIPT_QUERY = `query GioTranscript($id: String!) {
  transcript(id: $id) {
    id
    title
    date
    speakers { id name }
    sentences { index speaker_name speaker_id text start_time end_time }
    summary { overview short_summary keywords action_items shorthand_bullet }
  }
}`

export interface Sentence {
  i: number
  speaker: string
  text: string
  /** Seconds from the start of the call. */
  start: number
  end: number
}

export interface Speaker {
  id: string
  name: string
}

export interface FirefliesTranscript {
  id: string
  title: string | null
  sentences: Sentence[]
  speakers: Speaker[]
  durationSeconds: number | null
  /** Fireflies' own summary, as it gave it. */
  summary: Record<string, unknown> | null
}

export type FetchProblem = 'not_found' | 'unauthorized' | 'not_ready' | 'rate_limited' | 'error'

export type FetchResult =
  | { ok: true; transcript: FirefliesTranscript }
  | { ok: false; problem: FetchProblem }

/** What the person sees when Gio couldn't get the transcript (never Fireflies' own text). */
export const PROBLEM_REASON: Record<FetchProblem, string> = {
  not_found: "Fireflies doesn't have this meeting under Virgilio's account, so the notes use its summary.",
  unauthorized: "Gio couldn't sign in to Fireflies (the API key may have changed), so the notes use its summary.",
  not_ready: "Fireflies hadn't finished the transcript yet, so the notes use its summary.",
  rate_limited: 'Fireflies asked Gio to slow down, so the notes use its summary.',
  error: "Fireflies didn't answer, so the notes use its summary.",
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/** Fireflies' answer to our own shape: ordered sentences with speaker names, speakers, length. */
export function normalizeTranscript(raw: any): FirefliesTranscript | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null
  const speakers: Speaker[] = Array.isArray(raw.speakers)
    ? raw.speakers
        .filter((s: any) => s && (s.name || s.id != null))
        .map((s: any) => ({ id: String(s.id ?? ''), name: String(s.name ?? '').trim() || 'Speaker' }))
    : []
  const byId = new Map(speakers.map((s) => [s.id, s.name]))
  const sentences: Sentence[] = (Array.isArray(raw.sentences) ? raw.sentences : [])
    .map((s: any, k: number) => {
      const text = String(s?.text ?? '').trim()
      const start = num(s?.start_time)
      const end = num(s?.end_time)
      const name =
        String(s?.speaker_name ?? '').trim() ||
        (s?.speaker_id != null ? byId.get(String(s.speaker_id)) : '') ||
        'Speaker'
      return {
        i: num(s?.index) ?? k,
        speaker: name,
        text,
        start: start ?? 0,
        end: end ?? start ?? 0,
      }
    })
    .filter((s: Sentence) => s.text)
    .sort((a: Sentence, b: Sentence) => a.start - b.start || a.i - b.i)
  const last = sentences.reduce((m, s) => Math.max(m, s.end), 0)
  const summary = raw.summary && typeof raw.summary === 'object' ? raw.summary : null
  return {
    id: String(raw.id),
    title: raw.title ? String(raw.title) : null,
    sentences,
    speakers,
    durationSeconds: last > 0 ? Math.round(last) : null,
    summary,
  }
}

/** "12:05" for 725 seconds; "1:02:05" past the hour. */
export function clock(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/**
 * The transcript as the model reads it: one turn per line, "[mm:ss] Name: text", with
 * a speaker's consecutive sentences joined into one turn.
 */
export function transcriptText(sentences: Sentence[]): string {
  const turns: { speaker: string; start: number; parts: string[] }[] = []
  for (const s of sentences) {
    const last = turns[turns.length - 1]
    if (last && last.speaker === s.speaker) last.parts.push(s.text)
    else turns.push({ speaker: s.speaker, start: s.start, parts: [s.text] })
  }
  return turns.map((t) => `[${clock(t.start)}] ${t.speaker}: ${t.parts.join(' ')}`).join('\n')
}

/** Fireflies' GraphQL errors to one of our problems. */
export function problemFrom(status: number, body: any): FetchProblem | null {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limited'
  const errors: any[] = Array.isArray(body?.errors) ? body.errors : []
  if (errors.length) {
    const codes = errors
      .map((e) => String(e?.extensions?.code ?? e?.code ?? e?.message ?? '').toLowerCase())
      .join(' ')
    if (/auth|forbidden|unauthori[sz]ed|api key|invalid.*key/.test(codes)) return 'unauthorized'
    if (/too_many|rate/.test(codes)) return 'rate_limited'
    if (/not[_ ]?found|object_not_found|does not exist/.test(codes)) return 'not_found'
    return 'error'
  }
  if (status >= 400) return 'error'
  return null
}

/**
 * One call to Fireflies. A transcript that exists but has no sentences yet is
 * `not_ready` (Fireflies is still processing).
 */
export async function fetchFirefliesTranscript(
  id: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult> {
  let res: Response
  try {
    res = await fetchImpl(FIREFLIES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query: FIREFLIES_TRANSCRIPT_QUERY, variables: { id } }),
    })
  } catch {
    return { ok: false, problem: 'error' }
  }
  let body: any = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const problem = problemFrom(res.status, body)
  if (problem) return { ok: false, problem }
  const raw = body?.data?.transcript
  if (!raw) return { ok: false, problem: 'not_found' }
  const transcript = normalizeTranscript(raw)
  if (!transcript) return { ok: false, problem: 'not_found' }
  if (!transcript.sentences.length) return { ok: false, problem: 'not_ready' }
  return { ok: true, transcript }
}
