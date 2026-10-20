/**
 * Skill priority on a job (Allan, 2026-10-14). Stored on `jobs.skill_priorities`
 * as skill → priority; a skill with no entry is nice-to-have. The database keeps
 * `jobs.must_have_skills` in sync with the green ones.
 *
 * Gio Fit reads it: must-haves count toward the must-have caps, nice-to-haves
 * are what Skills Alignment is scored on, extras can lift but never lower.
 */
export type SkillPriority = 'must' | 'nice' | 'bonus'
export type SkillPriorities = Record<string, SkillPriority>

export const SKILL_PRIORITIES: SkillPriority[] = ['must', 'nice', 'bonus']

export const SKILL_PRIORITY: Record<SkillPriority, {
  label: string
  short: string
  hint: string
  /** Pill background + text, the same tones as the badges. */
  pill: string
  /** Outline variant for places where the pill sits on a tinted surface. */
  dot: string
}> = {
  must: {
    label: 'Must-have',
    short: 'Must',
    hint: 'Counts against the Gio Fit score when it is missing.',
    pill: 'bg-pastel-green text-pastel-green-foreground',
    dot: 'bg-pastel-green-foreground',
  },
  nice: {
    label: 'Nice-to-have',
    short: 'Nice',
    hint: 'Part of the skills match; missing it is a gap, not a cap.',
    pill: 'bg-pastel-blue text-pastel-blue-foreground',
    dot: 'bg-pastel-blue-foreground',
  },
  bonus: {
    label: 'Extra points',
    short: 'Extra',
    hint: 'Lifts the score when present; never lowers it.',
    pill: 'bg-badge-lilac text-badge-lilac-foreground',
    dot: 'bg-badge-lilac-foreground',
  },
}

export const isSkillPriority = (v: unknown): v is SkillPriority => v === 'must' || v === 'nice' || v === 'bonus'

/** Reads a priorities map off a job row (jsonb → typed, unknown values dropped). */
export function readSkillPriorities(raw: unknown): SkillPriorities {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: SkillPriorities = {}
  for (const [skill, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isSkillPriority(value)) out[skill] = value
  }
  return out
}

/** The priority of one skill; matching ignores case so "hubspot" finds "HubSpot". */
export function priorityOf(priorities: SkillPriorities | null | undefined, skill: string): SkillPriority {
  if (!priorities) return 'nice'
  const direct = priorities[skill]
  if (direct) return direct
  const key = skill.trim().toLowerCase()
  for (const [name, value] of Object.entries(priorities)) {
    if (name.trim().toLowerCase() === key) return value
  }
  return 'nice'
}

/** Must-haves first, then nice-to-haves, then extras; stable within a group. */
export function sortByPriority<T>(items: T[], priority: (item: T) => SkillPriority): T[] {
  const rank: Record<SkillPriority, number> = { must: 0, nice: 1, bonus: 2 }
  return items.map((item, index) => ({ item, index })).sort((a, b) => rank[priority(a.item)] - rank[priority(b.item)] || a.index - b.index).map((x) => x.item)
}

/** Gio's skills by tier, as generate-job-skills returns them (extra = bonus). */
export interface SuggestedSkills {
  must: string[]
  nice: string[]
  extra: string[]
  /** Years of experience read from the description and documents. */
  experience?: { min: number | null; max: number | null } | null
  /** Requirements that aren't CV skills (traits, location, years, contract), left for the interview. */
  leftOut?: string[]
}

/** The skills and priorities to store on a job for Gio's proposal. */
export function toJobSkills(s: SuggestedSkills): { skills: string[]; skill_priorities: SkillPriorities } {
  const skill_priorities: SkillPriorities = {}
  for (const skill of s.must) skill_priorities[skill] = 'must'
  for (const skill of s.nice) skill_priorities[skill] = 'nice'
  for (const skill of s.extra) skill_priorities[skill] = 'bonus'
  return { skills: [...s.must, ...s.nice, ...s.extra], skill_priorities }
}

/** The years Gio read, for whichever of the job's Min/Max years fields are still empty. */
export function yearsToFill(
  s: SuggestedSkills,
  job: { min_years_experience?: number | null; max_years_experience?: number | null },
): { min_years_experience?: number; max_years_experience?: number } {
  const out: { min_years_experience?: number; max_years_experience?: number } = {}
  if (s.experience?.min != null && job.min_years_experience == null) out.min_years_experience = s.experience.min
  if (s.experience?.max != null && job.max_years_experience == null) out.max_years_experience = s.experience.max
  return out
}
