/**
 * Suggested tab — the filter array is the single source of truth.
 *
 * The toolbar chips, the no-results remove-pills and the sub-line counts all
 * read from ONE array held in the tab's state. Never hardcode a chip label.
 */

export type SuggestedFilterDimension =
  | 'match'
  | 'in_pipeline'
  | 'previously_rejected'
  | 'location'
  | 'seniority'
  | 'skill'
  | 'recency'

export interface SuggestedFilter {
  /** Stable id — one filter per dimension (+ value where the dimension repeats). */
  id: string
  dimension: SuggestedFilterDimension
  /** Dimension word, e.g. "Match", "Hide". */
  label: string
  /** Value word, e.g. "≥ 70", "in pipeline". */
  value?: string
  min?: number
  days?: number
  text?: string
}

export const makeMatchFilter = (min: number): SuggestedFilter => ({
  id: 'match',
  dimension: 'match',
  label: 'Match',
  value: `≥ ${min}`,
  min,
})

export const makeSeniorityFilter = (min: number): SuggestedFilter => ({
  id: 'seniority',
  dimension: 'seniority',
  label: 'Seniority',
  value: `${min}+ yrs`,
  min,
})

export const makeRecencyFilter = (days: number): SuggestedFilter => ({
  id: 'recency',
  dimension: 'recency',
  label: 'Active',
  value: `last ${days} days`,
  days,
})

export const makeLocationFilter = (text: string): SuggestedFilter => ({
  id: `location:${text.toLowerCase()}`,
  dimension: 'location',
  label: 'Location',
  value: text,
  text,
})

export const makeSkillFilter = (text: string): SuggestedFilter => ({
  id: `skill:${text.toLowerCase()}`,
  dimension: 'skill',
  label: 'Skill',
  value: text,
  text,
})

export const HIDE_IN_PIPELINE: SuggestedFilter = {
  id: 'in_pipeline',
  dimension: 'in_pipeline',
  label: 'Hide',
  value: 'in pipeline',
}

export const HIDE_PREVIOUSLY_REJECTED: SuggestedFilter = {
  id: 'previously_rejected',
  dimension: 'previously_rejected',
  label: 'Hide',
  value: 'previously rejected',
}

/** Visible, removable defaults — not hidden behaviour. */
export const DEFAULT_SUGGESTED_FILTERS: SuggestedFilter[] = [makeMatchFilter(70), HIDE_IN_PIPELINE]

/** Dimensions where adding a new filter replaces the previous one. */
const SINGLETON_DIMENSIONS: SuggestedFilterDimension[] = [
  'match',
  'seniority',
  'recency',
  'in_pipeline',
  'previously_rejected',
]

export function addSuggestedFilter(
  filters: SuggestedFilter[],
  next: SuggestedFilter,
): SuggestedFilter[] {
  const withoutDuplicate = SINGLETON_DIMENSIONS.includes(next.dimension)
    ? filters.filter((f) => f.dimension !== next.dimension)
    : filters.filter((f) => f.id !== next.id)
  return [...withoutDuplicate, next]
}

export interface SuggestedFilterContext {
  /** Candidate ids already on this job's pipeline. */
  inPipelineIds?: Set<string>
  /** Candidate ids previously rejected (this job or another). */
  rejectedIds?: Set<string>
}

export const suggestedCandidateId = (c: any): string => c?.candidate_id || c?.id || ''

const candidateLocation = (c: any): string =>
  [c?.location, c?.location_city, c?.location_state, c?.location_country]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

const candidateSkills = (c: any): string[] =>
  [...(c?.skills || []), ...(c?.standardized_skills || [])].map((s: string) =>
    String(s).toLowerCase(),
  )

export const lastActivityAt = (c: any): number | null => {
  const raw = c?.enriched_at || c?.updated_at || c?.created_at
  const t = raw ? new Date(raw).getTime() : NaN
  return Number.isNaN(t) ? null : t
}

export const suggestedScore = (c: any): number | null => {
  const raw = c?.ai_fit_score ?? c?.match_score
  return typeof raw === 'number' && raw > 0 ? raw : null
}

/** Apply the active filter array to a suggestion list. Pure. */
export function applySuggestedFilters<T>(
  candidates: T[],
  filters: SuggestedFilter[],
  ctx: SuggestedFilterContext = {},
): T[] {
  if (!filters.length) return candidates
  return candidates.filter((raw) => {
    const c = raw as any
    return filters.every((f) => {
      switch (f.dimension) {
        case 'match':
          return (suggestedScore(c) ?? 0) >= (f.min ?? 0)
        case 'seniority':
          return (c.years_experience ?? 0) >= (f.min ?? 0)
        case 'in_pipeline':
          return !ctx.inPipelineIds?.has(suggestedCandidateId(c))
        case 'previously_rejected':
          return !ctx.rejectedIds?.has(suggestedCandidateId(c))
        case 'location':
          return candidateLocation(c).includes(String(f.text || '').toLowerCase())
        case 'skill':
          return candidateSkills(c).some((s) => s.includes(String(f.text || '').toLowerCase()))
        case 'recency': {
          const t = lastActivityAt(c)
          if (t === null) return false
          return Date.now() - t <= (f.days ?? 0) * 86400000
        }
        default:
          return true
      }
    })
  })
}

/**
 * Named evidence for one suggestion. A suggestion is a claim, so a row without
 * evidence is not rendered — never invent a generic "good fit" chip.
 */
export function suggestedReasons(c: any, jobSkills?: string[] | null): string[] {
  const reasons: string[] = []
  const skills = [...(c?.skills || []), ...(c?.standardized_skills || [])]
    .map((s: any) => String(s).trim())
    .filter(Boolean)

  const wanted = (jobSkills || []).map((s) => String(s).trim()).filter(Boolean)
  const wantedLower = wanted.map((s) => s.toLowerCase())

  const matched = wanted.length
    ? skills.filter((s) => wantedLower.some((w) => s.toLowerCase().includes(w) || w.includes(s.toLowerCase())))
    : skills

  const years = typeof c?.years_experience === 'number' && c.years_experience > 0 ? c.years_experience : null
  const role = c?.current_role || c?.role_current
  if (years && role) reasons.push(`${years} yrs ${role}`)
  else if (years) reasons.push(`${years} yrs experience`)

  const seen = new Set(reasons.map((r) => r.toLowerCase()))
  matched.forEach((s) => {
    const key = s.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      reasons.push(s)
    }
  })

  return reasons
}

/** Relative, rounded age of the last match run. */
export function formatMatchAge(at: Date | number | null | undefined): string | null {
  if (!at) return null
  const ms = Date.now() - new Date(at).getTime()
  if (Number.isNaN(ms)) return null
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** Concise "3 wks" style age for the Last active column. */
export function formatLastActive(at: number | null): { value: string; suffix: string } | null {
  if (at === null) return null
  const days = Math.max(Math.round((Date.now() - at) / 86400000), 0)
  if (days < 1) return { value: 'today', suffix: '' }
  if (days < 7) return { value: `${days}d`, suffix: ' ago' }
  if (days < 35) return { value: `${Math.round(days / 7)} wks`, suffix: ' ago' }
  if (days < 365) return { value: `${Math.round(days / 30)} mo`, suffix: ' ago' }
  return { value: `${Math.round(days / 365)} yr`, suffix: ' ago' }
}
