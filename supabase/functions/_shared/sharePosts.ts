/**
 * The share kit's posts (job exposure, Phase 1; Allan, Go! 2026-11-12): what Gio is
 * told about a job and how its answer is tidied. Pure, so `src/` tests it too.
 *
 * Gio writes a LinkedIn post and a WhatsApp message in the job post's own language,
 * in one of two voices: our team sharing a search ("team") or the hiring company
 * posting its own opening ("client"). Each holds `{link}` exactly once; the share kit
 * puts that channel's tagged link there. Pay is mentioned only when the job post shows it.
 */

export type ShareVoice = 'team' | 'client'

export interface ShareJobFacts {
  title: string
  company: string
  location?: string | null
  workMode?: string | null
  employmentType?: string | null
  /** Only when the job post shows pay, already written out ("MXN 40,000–60,000 a month"). */
  pay?: string | null
  /** The job post's text, plain. */
  description: string
}

export const LINK = '{link}'

const VOICE: Record<ShareVoice, string> = {
  team:
    'Write as a recruiter at Virgilio sharing a search they are running for the company named below ("We are helping … find …", "I am looking for …"). Name the company.',
  client:
    'Write as the company itself announcing its own opening ("We are hiring …", "Join our team …").',
}

export function sharePostsPrompt(job: ShareJobFacts, voice: ShareVoice): { system: string; user: string } {
  const system = `You write short posts that get qualified people to apply to a job.

Write two texts about the job below:
1. "linkedin": a LinkedIn post, 80 to 180 words. A first line that makes the right person stop scrolling (the role and what makes it worth a look, never a question like "Are you looking for a new challenge?"). Then two to four short lines or bullets on what the person will do and what they need. Then one line asking them to apply, then ${LINK} on its own line. At most three relevant hashtags on the last line. At most two emoji in the whole post.
2. "whatsapp": a WhatsApp message to forward to a group or a friend, 25 to 70 words: the role, the company, where, one reason it's a good opportunity, and ${LINK}. You may use *bold* once for the job title. No hashtags.

${VOICE[voice]}

Rules:
- Write in the same language as the job post (Spanish post: Spanish texts).
- Use only facts given below. Never invent benefits, numbers, team sizes or perks.
${job.pay ? `- You may mention the pay exactly as given: ${job.pay}.` : '- Never mention pay, salary or compensation.'}
- Put ${LINK} exactly once in each text, written exactly like that. No other links, no "link in bio".
- Plain text: no Markdown headings, no **bold**.

Answer with a JSON object: {"language": "<ISO 639-1 code of the texts>", "linkedin": "...", "whatsapp": "..."}.`

  const lines = [
    `Job title: ${job.title}`,
    `Company: ${job.company}`,
    job.location ? `Location: ${job.location}` : null,
    job.workMode ? `Work mode: ${job.workMode}` : null,
    job.employmentType ? `Employment type: ${job.employmentType}` : null,
    job.pay ? `Pay: ${job.pay}` : null,
    '',
    'Job post:',
    job.description.slice(0, 6000),
  ].filter((l) => l !== null)
  return { system, user: lines.join('\n') }
}

/** HTML or Markdown to plain text, keeping paragraph and list breaks. */
export function plainDescription(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\/\s*(p|div|h[1-6]|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Gio's text, tidied: no Markdown bold or headings (LinkedIn shows them as symbols),
 * no other links, `{link}` exactly once (added at the end when missing), clipped.
 */
export function cleanPost(text: unknown, kind: 'linkedin' | 'whatsapp'): string {
  let s = typeof text === 'string' ? text : ''
  s = s.replace(/\r\n?/g, '\n')
  s = s.replace(/^#{1,6}\s+/gm, '')
  s = s.replace(/\*\*(.+?)\*\*/g, kind === 'whatsapp' ? '*$1*' : '$1')
  // Gio sometimes writes the link out or in another form; only our placeholder stays.
  s = s.replace(/\{\{\s*link\s*\}\}|\[link\]|<link>/gi, LINK)
  s = s.replace(/https?:\/\/\S+/g, '')
  const parts = s.split(LINK)
  if (parts.length > 2) s = parts[0] + LINK + parts.slice(1).join('')
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const max = kind === 'linkedin' ? 2800 : 900
  if (s.length > max) s = s.slice(0, max - LINK.length - 2).trimEnd()
  if (!s.includes(LINK)) s = `${s}\n\n${LINK}`.trim()
  return s
}

/** The text with this channel's link in it. */
export function fillLink(text: string, link: string): string {
  return text.includes(LINK) ? text.replace(LINK, link) : `${text}\n\n${link}`.trim()
}

const PERIOD: Record<string, string> = {
  annually: 'per year',
  yearly: 'per year',
  annual: 'per year',
  monthly: 'per month',
  hourly: 'per hour',
  weekly: 'per week',
  daily: 'per day',
}

export function tidyLabel(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  return v.trim().replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface PostingFacts {
  location: string | null
  workMode: string | null
  employmentType: string | null
  /** "MXN 40,000 – 60,000 per month" only when the job post shows pay. */
  pay: string | null
}

/**
 * What a job post says about place, type and pay, by the public page's rule
 * (PublicJobPosting `details`): the posting's details first, the job's own fields after.
 */
export function postingFacts(
  details: Record<string, unknown> | null | undefined,
  job: {
    location?: string | null
    work_mode?: string | null
    salary_min?: number | null
    salary_max?: number | null
    currency?: string | null
    show_salary_public?: boolean | null
  } | null | undefined,
): PostingFacts {
  const d = (details ?? {}) as Record<string, any>
  const j = job ?? {}
  const min = d.salary_min ?? null
  const max = d.salary_max ?? null
  const amount = d.salary_amount ?? max ?? min ?? j.salary_max ?? j.salary_min ?? null
  const lo = min ?? j.salary_min ?? null
  const hi = max ?? j.salary_max ?? null
  const currency = d.salary_currency || j.currency || ''
  const show = typeof d.show_salary_public === 'boolean' ? d.show_salary_public : !!d.show_salary || !!j.show_salary_public
  let pay: string | null = null
  if (show && amount) {
    const fmt = (n: unknown) => Number(n).toLocaleString('en-US')
    const range = lo && hi && Number(lo) !== Number(hi) ? `${fmt(lo)} – ${fmt(hi)}` : fmt(amount)
    const period = typeof d.salary_period === 'string' ? PERIOD[d.salary_period.toLowerCase()] ?? tidyLabel(d.salary_period) : null
    pay = `${currency} ${range}${period ? ` ${period}` : ''}`.trim()
  }
  const extra = Array.isArray(d.additional_locations)
    ? d.additional_locations.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  const places = [d.location || j.location || null, ...extra].filter(Boolean)
  return {
    location: places.length ? places.join(' · ') : null,
    workMode: tidyLabel(d.location_type || j.work_mode),
    employmentType: tidyLabel(d.employment_type),
    pay,
  }
}
