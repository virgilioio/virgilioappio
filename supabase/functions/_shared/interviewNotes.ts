// Interview notes from a note-taker's email (Fireflies, Read.ai), shared by
// process-transcript-webhook and generate-scorecard-from-transcript (2026-11-11).
//
// What reaches the ingest address is usually the note-taker's recap email, not the
// conversation: a few lines of summary wrapped in links, images and advertising. This
// keeps only what was said about the interview, says which kind of source it is, and
// pulls out the Fireflies meeting id so the full transcript can be fetched later.

export type SourceKind = 'summary' | 'transcript'

export interface CleanedSource {
  text: string
  kind: SourceKind
  provider: 'fireflies' | 'read_ai' | 'other'
  /** Fireflies' transcript id, from the recap's "View meeting recap" link. */
  firefliesId: string | null
}

const FIREFLIES_ID = /app\.fireflies\.ai\/view\/[^\s\]\)]*?::([A-Za-z0-9]{10,40})/

/** Fireflies' transcript id from anything that holds its recap link. */
export function firefliesIdFrom(text: string): string | null {
  return text.match(FIREFLIES_ID)?.[1] ?? null
}

// Combining grapheme joiner, zero-width spaces and joiners, soft hyphen, word joiner and
// BOM: what email preheaders pad with. Built from code points so the source stays
// plain ASCII (the function deploy tool rewrites escape sequences).
const PREHEADER_FILLER = new RegExp(
  '[' + String.fromCharCode(0x034f, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x00ad, 0x2060, 0xfeff) + ']+',
  'g',
)

/** Links, image references, invisible preheader filler and access tokens out. */
export function stripEmailNoise(text: string): string {
  return text
    .replace(/\[https?:\/\/[^\]]*\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    // Preheader padding (combining grapheme joiner, zero-width and soft-hyphen runs)
    .replace(PREHEADER_FILLER, '')
    // Signed tokens some recaps carry (JWTs, "…_token:…")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '')
    .replace(/\b\w*token:\S+/gi, '')
    .replace(/&lt;nil&gt;|<nil>/g, '')
    // Read.ai's recap carries a dump of its template data ("%!s(float64=96)")
    .replace(/%!s\([^)]*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function between(lines: string[], start: RegExp, stop: RegExp): string[] {
  const i = lines.findIndex((l) => start.test(l))
  if (i < 0) return []
  const out: string[] = []
  // A heading can carry its first item on the same line ("Discussed in this meeting X").
  const rest = lines[i].replace(start, '').trim()
  if (rest) out.push(rest)
  for (let j = i + 1; j < lines.length; j++) {
    if (stop.test(lines[j])) break
    out.push(lines[j])
  }
  return out
}

/**
 * A Fireflies recap email down to what it says about the meeting: its name, when it
 * was, the topics and the Meeting Overview bullets. Everything else is Fireflies'
 * own advertising and footer. A recap with no overview comes back with only its
 * name and date, which the empty-call check then reads as nothing said.
 */
export function cleanFirefliesRecap(raw: string): string {
  const lines = stripEmailNoise(raw)
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
  const trimmed = lines.map((l) => l.trim())

  const dateAt = trimmed.findIndex((l) =>
    /^[A-Z][a-z]{2,8}\.? \d{1,2}(st|nd|rd|th)? at \d{1,2}:\d{2}\s*(AM|PM)/i.test(l),
  )
  let title = ''
  if (dateAt > 0) {
    for (let k = dateAt - 1; k >= 0; k--) {
      if (trimmed[k]) { title = trimmed[k]; break }
    }
  }

  const topics = between(trimmed, /^Discussed in this meeting/i, /^(See more insights|\+\d+ more|Meeting Overview)/i)
    .map((t) => t.trim())
    .filter(Boolean)

  const overviewLines = between(lines, /^\s*Meeting Overview\s*$/i, /^\s*(View complete meeting notes|Supercharge your)/i)
  // Bullets wrap over several lines in the email; join each back into one.
  const bullets: string[] = []
  for (const l of overviewLines) {
    const t = l.trim()
    if (!t) continue
    if (/^[*•-]\s+/.test(t)) bullets.push(t.replace(/^[*•-]\s+/, ''))
    else if (bullets.length) bullets[bullets.length - 1] += ` ${t}`
    else bullets.push(t)
  }

  const out: string[] = []
  if (title) out.push(`Meeting: ${title}`)
  if (dateAt >= 0) out.push(`When: ${trimmed[dateAt]}`)
  if (topics.length) out.push(`Topics: ${topics.join(', ')}`)
  if (bullets.length) {
    out.push('', 'Meeting overview:')
    for (const b of bullets) out.push(`- ${b}`)
  }
  return out.join('\n').trim()
}

/** What arrived at the ingest address, cleaned and labelled. */
export function cleanInboundText(raw: string, from: string): CleanedSource {
  const sender = (from || '').toLowerCase()
  const firefliesId = firefliesIdFrom(raw)
  if (sender.includes('fireflies.ai') || /Fred from Fireflies|invited Fireflies to your meeting/i.test(raw)) {
    return { text: cleanFirefliesRecap(raw), kind: 'summary', provider: 'fireflies', firefliesId }
  }
  if (sender.includes('read.ai')) {
    return { text: stripEmailNoise(raw), kind: 'summary', provider: 'read_ai', firefliesId: null }
  }
  return { text: stripEmailNoise(raw), kind: 'transcript', provider: 'other', firefliesId }
}

/** The header lines `cleanFirefliesRecap` adds, which say nothing about the interview. */
const HEADER_LINE = /^(Meeting|When|Topics):.*$/gim

/**
 * How many words of real content a source holds: timestamps, speaker labels, join and
 * leave notices, greetings and fillers, and the recap's own header lines don't count.
 */
export function substantiveWords(text: string): number {
  const t = text
    .replace(HEADER_LINE, '')
    // A fetched transcript's turns: "[12:05] Allan Bravo: ..." (src: _shared/fireflies.ts)
    .replace(/^\[\d{1,2}:\d{2}(:\d{2})?\]\s*[^:\n]{1,60}:/gm, '')
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)?\s*/g, '')
    .replace(/\[\d{1,2}:\d{2}(:\d{2})?\]/g, '')
    .replace(/Speaker\s*\d+\s*:/gi, '')
    .replace(/(Host|Guest|Participant|Interviewer|Interviewee)\s*\d*\s*:/gi, '')
    .replace(/^.*\b(joined|left|entered|exited|started recording|stopped recording|recording started|recording stopped|meeting started|meeting ended|call started|call ended|waiting for others|has joined the meeting|has left the meeting)\b.*$/gim, '')
    .replace(/\b(um+|uh+|hmm+|okay|ok|yeah|yes|no|hi|hello|hey|bye|goodbye|thanks|thank you)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t ? t.split(' ').filter((w) => w.length > 1).length : 0
}

/** Below this, there's nothing to write notes from. A summary is denser than speech. */
export function tooLittleToDraft(text: string, kind: SourceKind): boolean {
  return substantiveWords(text) < (kind === 'summary' ? 25 : 50)
}

// ── Ratings ──────────────────────────────────────────────────────────────────

/** The scorecard's own five-point scale (src/lib/scorecardRatings.ts), weakest first. */
export const SUGGESTED_RATINGS = ['strong_no', 'lean_no', 'lean_yes', 'yes', 'strong_yes'] as const
export type SuggestedRating = (typeof SUGGESTED_RATINGS)[number]

const RATING_ALIASES: Record<string, SuggestedRating> = {
  strong_no: 'strong_no', definitely_no: 'strong_no', 'strong no': 'strong_no', 'definitely no': 'strong_no',
  lean_no: 'lean_no', no: 'lean_no', 'lean no': 'lean_no',
  lean_yes: 'lean_yes', 'lean yes': 'lean_yes',
  yes: 'yes',
  strong_yes: 'strong_yes', 'strong yes': 'strong_yes',
}

/**
 * Gio's rating on the scorecard's scale, or null when there's none to give
 * ("not_enough", missing, anything unknown). Never a default "yes".
 */
export function toSuggestedRating(value: unknown): SuggestedRating | null {
  if (typeof value !== 'string') return null
  return RATING_ALIASES[value.trim().toLowerCase()] ?? null
}

/** The in-job profile with your own scorecard open (`?focus=my-scorecard`). */
export function scorecardLink(frontendUrl: string, jobId?: string | null, candidateId?: string | null): string {
  const base = frontendUrl.replace(/\/+$/, '')
  if (jobId && candidateId) return `${base}/jobs/${jobId}/candidates/${candidateId}?focus=my-scorecard`
  if (jobId) return `${base}/jobs/${jobId}`
  return base
}
