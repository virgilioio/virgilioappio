import type { SearchCriteria } from '@/types/sourcing'

/**
 * A Find search's skills (Allan, 2026-10-22), as the server reads them
 * (_shared/findCriteria.ts skillTiers): criteria.skills in the order they were
 * added, each with a priority in skill_priorities (must / nice / bonus, like a
 * job); older searches' keywords count as nice. One field edits them, the way
 * the job wizard does: a new skill is nice, its chevron changes the priority.
 */
export type FindTier = 'must' | 'nice' | 'bonus'
export interface FindSkills { skills: string[]; priorities: Record<string, FindTier> }

const tierOf = (v: unknown): FindTier => (v === 'must' || v === 'bonus' ? v : 'nice')

export function skillsOf(c: Partial<SearchCriteria> | null | undefined): FindSkills {
  const out: FindSkills = { skills: [], priorities: {} }
  const seen = new Set<string>()
  const add = (raw: unknown, tier: FindTier) => {
    if (typeof raw !== 'string') return
    const v = raw.trim()
    const k = v.toLowerCase()
    if (!v || seen.has(k)) return
    seen.add(k)
    out.skills.push(v)
    out.priorities[v] = tier
  }
  const pr = c?.skill_priorities ?? {}
  for (const s of c?.skills ?? []) add(s, tierOf(pr[s]))
  for (const k of c?.keywords ?? []) add(k, 'nice')
  return out
}

/** The criteria fields for these skills; older keywords move into skills. */
export function criteriaFromSkills(s: FindSkills): Pick<SearchCriteria, 'skills' | 'skill_priorities' | 'keywords'> {
  const skill_priorities: Record<string, FindTier> = {}
  for (const skill of s.skills) skill_priorities[skill] = tierOf(s.priorities[skill])
  return { skills: [...s.skills], skill_priorities, keywords: [] }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Adds a skill at the end (nice unless told otherwise); one already there keeps its place and priority. */
export function addSkill(s: FindSkills, skill: string, tier: FindTier = 'nice'): FindSkills {
  const v = skill.trim()
  if (!v || s.skills.some((x) => same(x, v))) return s
  return { skills: [...s.skills, v], priorities: { ...s.priorities, [v]: tier } }
}

export function removeSkill(s: FindSkills, skill: string): FindSkills {
  const priorities = { ...s.priorities }
  const skills = s.skills.filter((x) => {
    if (!same(x, skill)) return true
    delete priorities[x]
    return false
  })
  return { skills, priorities }
}

/** Changes a skill's priority in place, so its chip doesn't move. */
export function setSkillTier(s: FindSkills, skill: string, tier: FindTier): FindSkills {
  const match = s.skills.find((x) => same(x, skill))
  return match ? { skills: s.skills, priorities: { ...s.priorities, [match]: tier } } : s
}

export const mustCount = (s: FindSkills) => s.skills.filter((x) => s.priorities[x] === 'must').length
