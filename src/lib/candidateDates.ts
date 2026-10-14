import type { AssociationDetail } from '@/hooks/useCandidateJobAssociations'

/**
 * Date filters and sorting on the Candidates page (2026-10-14).
 *
 * Each candidate has a few kinds of dates. A filter keeps the candidate when
 * any of their dates of that kind falls in the range; sorting uses the latest
 * one. Ranges are stored relative ("last 30 days") or as fixed dates, so a
 * saved search keeps meaning "the last 30 days" tomorrow.
 *
 * - added        added to Gio (candidates.created_at)
 * - applied      entered a job's pipeline without anyone on the team adding
 *                them: careers page, LinkedIn or job board applies
 * - added_to_job entered any job's pipeline (applied or added)
 * - interview    a booked interview, not cancelled and not a no-show; can be
 *                upcoming
 * - stage_moved  last moved to a new stage in a pipeline
 * - offer, hired, rejected   when that happened in a pipeline
 * - updated      the profile was last edited
 */
export type DateField =
  | 'added' | 'applied' | 'added_to_job' | 'interview'
  | 'stage_moved' | 'offer' | 'hired' | 'rejected' | 'updated'

export interface DateRangeFilter {
  field: DateField
  /** The last N days, up to now. */
  within?: number | null
  /** The next N days, from now (interviews). */
  next?: number | null
  /** Fixed dates, yyyy-mm-dd, inclusive. */
  from?: string | null
  to?: string | null
}

export const DATE_FIELDS: { field: DateField; label: string; past: string; future?: string }[] = [
  { field: 'added', label: 'Added to Gio', past: 'Added' },
  { field: 'applied', label: 'Applied', past: 'Applied' },
  { field: 'added_to_job', label: 'Added to a job', past: 'Added to a job' },
  { field: 'interview', label: 'Interview', past: 'Interviewed', future: 'Interview' },
  { field: 'stage_moved', label: 'Moved stage', past: 'Moved stage' },
  { field: 'offer', label: 'Offer', past: 'Offer' },
  { field: 'hired', label: 'Hired', past: 'Hired' },
  { field: 'rejected', label: 'Rejected', past: 'Rejected' },
  { field: 'updated', label: 'Profile updated', past: 'Updated' },
]

export const fieldLabel = (f: DateField) => DATE_FIELDS.find((d) => d.field === f)?.label ?? f

const DAY = 86_400_000

function startOfDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
}

/** [start, end] in ms for a range, or null when it has no bounds. */
export function rangeBounds(r: DateRangeFilter, now = Date.now()): [number, number] | null {
  if (r.within != null && r.within > 0) return [now - r.within * DAY, now]
  if (r.next != null && r.next > 0) return [now, now + r.next * DAY]
  if (r.from || r.to) {
    return [
      r.from ? startOfDay(r.from) : Number.NEGATIVE_INFINITY,
      r.to ? startOfDay(r.to) + DAY - 1 : Number.POSITIVE_INFINITY,
    ]
  }
  return null
}

const fmt = (iso: string) => {
  const t = startOfDay(iso)
  const d = new Date(t)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** "last 30 days", "next 7 days", "Jan 3 – Feb 1", "since Mar 4", "until Apr 1". */
export function rangeLabel(r: DateRangeFilter): string {
  if (r.within != null && r.within > 0) return r.within === 1 ? 'last 24 hours' : `last ${r.within} days`
  if (r.next != null && r.next > 0) return `next ${r.next} days`
  if (r.from && r.to) return r.from === r.to ? fmt(r.from) : `${fmt(r.from)} – ${fmt(r.to)}`
  if (r.from) return `since ${fmt(r.from)}`
  if (r.to) return `until ${fmt(r.to)}`
  return 'any time'
}

export function chipLabel(r: DateRangeFilter): string {
  const f = DATE_FIELDS.find((d) => d.field === r.field)
  const name = r.next ? (f?.future ?? f?.label) : f?.past ?? r.field
  return `${name} · ${rangeLabel(r)}`
}

export interface DatedCandidate {
  id: string
  created_at: string
  updated_at?: string | null
}

const ms = (v: string | null | undefined) => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

/** Every date of one kind for one candidate. */
export function datesFor(
  field: DateField,
  c: DatedCandidate,
  assocs: AssociationDetail[] | undefined,
  interviews: number[] | undefined,
): number[] {
  const pick = (get: (a: AssociationDetail) => string | null | undefined, only?: (a: AssociationDetail) => boolean) =>
    (assocs ?? []).filter((a) => !only || only(a)).map((a) => ms(get(a))).filter((t): t is number => t != null)
  switch (field) {
    case 'added': return [ms(c.created_at)].filter((t): t is number => t != null)
    case 'updated': return [ms(c.updated_at)].filter((t): t is number => t != null)
    case 'applied': return pick((a) => a.createdAt, (a) => !a.addedBy)
    case 'added_to_job': return pick((a) => a.createdAt)
    case 'stage_moved': return pick((a) => a.enteredStageAt)
    case 'offer': return pick((a) => a.offeredAt)
    case 'hired': return pick((a) => a.hiredAt)
    case 'rejected': return pick((a) => a.rejectedAt)
    case 'interview': return interviews ?? []
  }
}

export function inRange(dates: number[], r: DateRangeFilter, now = Date.now()): boolean {
  const b = rangeBounds(r, now)
  if (!b) return true
  return dates.some((t) => t >= b[0] && t <= b[1])
}

/* ── Sorting ─────────────────────────────────────────────────────────────── */

export type SortKey =
  | 'added_desc' | 'added_asc' | 'applied' | 'interview' | 'stage_moved'
  | 'updated' | 'furthest' | 'name' | 'experience'

export const SORTS: { key: SortKey; label: string; column?: { field: DateField; label: string } }[] = [
  { key: 'added_desc', label: 'Newest added', column: { field: 'added', label: 'Added' } },
  { key: 'added_asc', label: 'Oldest added', column: { field: 'added', label: 'Added' } },
  { key: 'applied', label: 'Recently applied', column: { field: 'applied', label: 'Applied' } },
  { key: 'interview', label: 'Latest interview', column: { field: 'interview', label: 'Interview' } },
  { key: 'stage_moved', label: 'Recently moved stage', column: { field: 'stage_moved', label: 'Moved stage' } },
  { key: 'updated', label: 'Recently updated', column: { field: 'updated', label: 'Updated' } },
  { key: 'furthest', label: 'Furthest in pipeline' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'experience', label: 'Most experience' },
]

export const isSortKey = (v: unknown): v is SortKey => SORTS.some((s) => s.key === v)

export const latest = (dates: number[]) => (dates.length ? Math.max(...dates) : null)

/** "today", "3d", "2w", "4mo", "1y"; upcoming: "in 3d", "today". */
export function shortWhen(t: number, now = Date.now()): string {
  const days = (now - t) / DAY
  if (days < 0) {
    const ahead = -days
    if (ahead < 1) return 'today'
    if (ahead < 7) return `in ${Math.ceil(ahead)}d`
    if (ahead < 30) return `in ${Math.round(ahead / 7)}w`
    return `in ${Math.round(ahead / 30)}mo`
  }
  if (days < 1) return 'today'
  if (days < 7) return `${Math.floor(days)}d`
  if (days < 30) return `${Math.floor(days / 7)}w`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}

/* ── How far someone got ─────────────────────────────────────────────────── */

export interface Reached {
  /** Hired 3, offer 2, otherwise how far along the stages (0–1). */
  score: number
  /** "Hired", "Offer", "Final interview", "Panel (rejected)". */
  label: string
  jobTitle: string
}

/**
 * The furthest anyone got in a pipeline (2026-10-14), across their jobs or only
 * the given ones. Someone rejected at a late stage still counts as having got
 * that far; at the same point, people still in the running come first.
 */
export function furthestReached(assocs: AssociationDetail[] | undefined, onlyJobs?: string[]): Reached | null {
  let best: Reached | null = null
  for (const a of assocs ?? []) {
    if (onlyJobs?.length && !onlyJobs.includes(a.jobId)) continue
    const status = a.pipelineStatus ?? ''
    let score: number
    let label: string
    if (status === 'hired' || a.hiredAt) { score = 3; label = 'Hired' }
    else if (status === 'offer') { score = 2; label = 'Offer' }
    else {
      score = (a.stageProgress ?? 0) + (status === 'rejected' ? 0 : 0.001)
      label = a.stageLabel ?? a.stageName ?? 'In pipeline'
      if (status === 'rejected') label = `${label} (rejected)`
    }
    if (!best || score > best.score) best = { score, label, jobTitle: a.jobTitle }
  }
  return best
}
