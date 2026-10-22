import type { SearchCriteria } from '@/types/sourcing'

/**
 * A Find search's skills by tier (Allan, 2026-10-22), as the server reads them
 * (_shared/findCriteria.ts skillTiers): criteria.skills with skill_priorities
 * (must / nice / bonus, like a job); older searches' keywords count as nice.
 */
export type FindTier = 'must' | 'nice' | 'bonus'
export interface FindTiers { must: string[]; nice: string[]; bonus: string[] }

export function tiersOf(c: Partial<SearchCriteria> | null | undefined): FindTiers {
  const out: FindTiers = { must: [], nice: [], bonus: [] }
  const seen = new Set<string>()
  const add = (raw: unknown, tier: FindTier) => {
    if (typeof raw !== 'string') return
    const v = raw.trim()
    const k = v.toLowerCase()
    if (!v || seen.has(k)) return
    seen.add(k)
    out[tier].push(v)
  }
  const pr = c?.skill_priorities ?? {}
  for (const s of c?.skills ?? []) add(s, pr[s] === 'must' ? 'must' : pr[s] === 'bonus' ? 'bonus' : 'nice')
  for (const k of c?.keywords ?? []) add(k, 'nice')
  return out
}

/** The criteria fields for these tiers; older keywords move into skills. */
export function criteriaFromTiers(t: FindTiers): Pick<SearchCriteria, 'skills' | 'skill_priorities' | 'keywords'> {
  const skill_priorities: Record<string, FindTier> = {}
  for (const tier of ['must', 'nice', 'bonus'] as const) for (const s of t[tier]) skill_priorities[s] = tier
  return { skills: [...t.must, ...t.nice, ...t.bonus], skill_priorities, keywords: [] }
}

/** Puts a skill in one tier (taking it out of the others). */
export function placeSkill(t: FindTiers, skill: string, tier: FindTier): FindTiers {
  const k = skill.trim().toLowerCase()
  const without = (list: string[]) => list.filter((s) => s.toLowerCase() !== k)
  const next: FindTiers = { must: without(t.must), nice: without(t.nice), bonus: without(t.bonus) }
  next[tier] = [...next[tier], skill.trim()]
  return next
}

export function dropSkill(t: FindTiers, skill: string): FindTiers {
  const k = skill.trim().toLowerCase()
  const without = (list: string[]) => list.filter((s) => s.toLowerCase() !== k)
  return { must: without(t.must), nice: without(t.nice), bonus: without(t.bonus) }
}
