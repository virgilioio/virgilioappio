import type { CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import type { CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'

export function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter((item): item is string => !!item)
}

export function stripHtml(value?: string | null) {
  if (!value) return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

export function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function formatDuration(startValue?: string, endValue?: string) {
  if (!startValue) return null
  const start = new Date(startValue)
  const end = endValue ? new Date(endValue) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / 2_629_746_000))
  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (!years) return `${months} mo`
  return `${years} yr${years === 1 ? '' : 's'}${remainder ? ` ${remainder} mo` : ''}`
}

export function normalizeSkill(value: string) {
  let normalized = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
  normalized = normalized
    .split(' ')
    .map((word) => {
      if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
      if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2)
      if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1)
      return word
    })
    .join(' ')
  return normalized
}

export function getScoreBand(score: number) {
  if (score >= 90) return 'Exceptional'
  if (score >= 75) return 'Strong'
  if (score >= 60) return 'Mixed'
  if (score >= 40) return 'Weak'
  return 'Poor'
}

export function splitExecutiveSummary(summary: string) {
  const match = summary.match(/strongest signal\s*[:—-]\s*([\s\S]+?)\s+biggest risk\s*[:—-]\s*([\s\S]+)/i)
  if (!match) return null
  const strongest = match[1]?.trim()
  const risk = match[2]?.trim()
  return strongest && risk ? { strongest, risk } : null
}

/** Removes the scoring-mechanics clause from a risk sentence for client-ready output. */
export function dropScoreClause(value: string) {
  return value
    .replace(/\s*[—–-]\s*[^.—–-]*\b(scor\w*|points?|weight\w*|rubric)\b[^.]*\.?\s*$/i, '.')
    .replace(/\s*,?\s*which is what holds the score[^.]*\.?/i, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export type SkillStatus = 'evidenced' | 'partial' | 'not_evidenced'

export interface SkillVerdict {
  skill: string
  status: SkillStatus
  evidence: string | null
  source: string | null
}

export interface SkillGroups {
  evidenced: SkillVerdict[]
  partly: SkillVerdict[]
  notEvidenced: SkillVerdict[]
  additional: string[]
  /** True when the groups come from the analysis's per-skill verdicts. */
  hasVerdicts: boolean
}

/** Reads the per-skill verdicts stored on the analysis, if they are present and well formed. */
export function readSkillEvidence(analysis: unknown): SkillVerdict[] | null {
  const raw = (analysis as Record<string, unknown> | null | undefined)?.skill_evidence
  if (!Array.isArray(raw) || raw.length === 0) return null
  const entries = raw
    .map((entry) => {
      const record = entry as Record<string, unknown>
      const skill = typeof record?.skill === 'string' ? record.skill.trim() : ''
      const status = record?.status
      if (!skill) return null
      if (status !== 'evidenced' && status !== 'partial' && status !== 'not_evidenced') return null
      const evidence = typeof record?.evidence === 'string' && record.evidence.trim() ? record.evidence.trim() : null
      const source = typeof record?.source === 'string' && record.source.trim() ? record.source.trim() : null
      return { skill, status, evidence, source } as SkillVerdict
    })
    .filter((entry): entry is SkillVerdict => entry !== null)
  return entries.length > 0 ? entries : null
}

export function buildSkillGroups(
  requiredSkills: string[],
  candidateSkills: string[],
  skillEvidence?: SkillVerdict[] | null,
): SkillGroups {
  const requiredMap = new Map(requiredSkills.map((skill) => [normalizeSkill(skill), skill]))
  const additional = candidateSkills.filter((skill) => !requiredMap.has(normalizeSkill(skill)))

  if (skillEvidence && skillEvidence.length > 0) {
    return {
      evidenced: skillEvidence.filter((entry) => entry.status === 'evidenced'),
      partly: skillEvidence.filter((entry) => entry.status === 'partial'),
      notEvidenced: skillEvidence.filter((entry) => entry.status === 'not_evidenced'),
      additional,
      hasVerdicts: true,
    }
  }

  // Legacy analyses carry no verdicts. The literal comparison is only a holding
  // pattern until the analysis is regenerated.
  const candidateMap = new Map(candidateSkills.map((skill) => [normalizeSkill(skill), skill]))
  const asVerdict = (skill: string, status: SkillStatus): SkillVerdict => ({ skill, status, evidence: null, source: null })
  return {
    evidenced: requiredSkills.filter((skill) => candidateMap.has(normalizeSkill(skill))).map((skill) => asVerdict(skill, 'evidenced')),
    partly: [],
    notEvidenced: requiredSkills.filter((skill) => !candidateMap.has(normalizeSkill(skill))).map((skill) => asVerdict(skill, 'not_evidenced')),
    additional,
    hasVerdicts: false,
  }
}

export interface ExperienceStat {
  value: string
  label: string
  footnote?: string
}

export function computeExperienceStats(
  experience: CandidateWorkExperience[],
  salaryExpectation?: string | null,
): ExperienceStat[] {
  const validRows = experience
    .map((entry) => {
      const start = entry.start_date ? new Date(entry.start_date) : null
      const end = entry.end_date ? new Date(entry.end_date) : new Date()
      if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
      return { entry, start, end }
    })
    .filter((row): row is { entry: CandidateWorkExperience; start: Date; end: Date } => !!row)

  const totalMonths = validRows.reduce((sum, row) => sum + Math.max(1, Math.round((row.end.getTime() - row.start.getTime()) / 2_629_746_000)), 0)
  const seniorPattern = /\b(senior|sr\.?|lead|head|director|vp|vice president|chief|principal|manager)\b/i
  const seniorMonths = validRows
    .filter(({ entry }) => seniorPattern.test(`${entry.job_title} ${entry.standardized_title || ''}`))
    .reduce((sum, row) => sum + Math.max(1, Math.round((row.end.getTime() - row.start.getTime()) / 2_629_746_000)), 0)
  const companies = new Set(experience.map((entry) => entry.company_name?.trim().toLocaleLowerCase()).filter(Boolean)).size
  const teamSizes = experience.flatMap((entry) => {
    const description = stripHtml(entry.description)
    const matches = [...description.matchAll(/(?:team(?: of)?|managed|led|supervised)\s+(?:a\s+)?(?:team\s+of\s+)?(\d{1,4})\b/gi)]
    return matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value > 0)
  })

  return [
    ...(totalMonths > 0 ? [{ value: `${(totalMonths / 12).toFixed(totalMonths % 12 ? 1 : 0)} yrs`, label: 'Total experience' }] : []),
    ...(seniorMonths > 0 ? [{ value: `${(seniorMonths / 12).toFixed(seniorMonths % 12 ? 1 : 0)} yrs`, label: 'Senior or above', footnote: 'Based on role titles' }] : []),
    ...(companies > 0 ? [{ value: String(companies), label: 'Companies' }] : []),
    ...(salaryExpectation ? [{ value: salaryExpectation, label: 'Salary expectation', footnote: 'Stated by the candidate' }] : []),
    ...(teamSizes.length ? [{ value: String(Math.max(...teamSizes)), label: 'Largest team led', footnote: 'Explicitly stated in experience' }] : []),
  ]
}

export function educationYear(item: CandidateEducation) {
  const source = item.end_date || item.start_date
  if (!source) return null
  const year = new Date(source).getFullYear()
  return Number.isFinite(year) ? String(year) : null
}
