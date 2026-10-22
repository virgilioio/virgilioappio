/**
 * A sourcing project's criteria, read the same way for our own candidates
 * and for Apollo's, and the rule-based fit score Find ranks both by
 * (Find Phase 1, 2026-10-12).
 *
 * The fit score is deterministic and explainable: title 45, location 25,
 * seniority 15, keywords or target company 15. Tiers: 85+ excellent ("Top
 * match" territory), 70+ good, 55+ fair, else minimal. Since 2026-10-22 Find
 * itself uses searchMatch() (people with a profile) and previewChecks() (Apollo
 * previews) below; fitScore stays for pool-builder's minimum bar.
 */

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  US: 'United States', CA: 'Canada', MX: 'Mexico', BR: 'Brazil', AR: 'Argentina', CL: 'Chile',
  CO: 'Colombia', PE: 'Peru', VE: 'Venezuela', EC: 'Ecuador', GT: 'Guatemala', CR: 'Costa Rica',
  PA: 'Panama', UY: 'Uruguay', BO: 'Bolivia', PY: 'Paraguay', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', DO: 'Dominican Republic', PR: 'Puerto Rico', GB: 'United Kingdom', UK: 'United Kingdom',
  DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium', SE: 'Sweden',
  NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland', PT: 'Portugal', IE: 'Ireland', CH: 'Switzerland',
  AT: 'Austria', CZ: 'Czech Republic', RO: 'Romania', HU: 'Hungary', UA: 'Ukraine', GR: 'Greece',
  IN: 'India', PH: 'Philippines', SG: 'Singapore', AU: 'Australia', NZ: 'New Zealand', JP: 'Japan',
  AE: 'United Arab Emirates', IL: 'Israel', ZA: 'South Africa', EG: 'Egypt', NG: 'Nigeria', KE: 'Kenya',
}

const LATAM = [
  'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Guatemala',
  'Costa Rica', 'Panama', 'Uruguay', 'Bolivia', 'Paraguay', 'Honduras', 'El Salvador', 'Nicaragua',
  'Dominican Republic', 'Puerto Rico',
]

// Keys are folded with normKey (accents dropped), so "Mexico" and its accented
// spelling share one entry and this file stays ASCII.
const NAME_ALIASES: Record<string, string> = {
  'mexico': 'Mexico', 'peru': 'Peru', 'brasil': 'Brazil', 'usa': 'United States',
  'united states of america': 'United States', 'estados unidos': 'United States', 'espana': 'Spain',
  'colombia': 'Colombia', 'argentina': 'Argentina', 'chile': 'Chile', 'uk': 'United Kingdom',
}

/** Lower-case, accents folded, letters and spaces only (mirrors person_name_key in SQL). */
export function normKey(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countryName(part: string): string | null {
  const p = part.trim()
  if (!p) return null
  if (/^[A-Za-z]{2}$/.test(p)) return COUNTRY_CODE_TO_NAME[p.toUpperCase()] ?? null
  return NAME_ALIASES[normKey(p)] ?? p
}

/**
 * A search location as Apollo should get it: "Remote" / "Anywhere" / "Global"
 * mean no place filter (null), "LATAM" becomes its countries, anything else
 * passes through as one entry.
 */
export function regionFor(value: string): string[] | null {
  const lower = normKey(value)
  if (lower === 'remote' || lower === 'anywhere' || lower === 'global') return null
  if (lower === 'latam' || lower === 'latin america' || lower === 'latinoamerica') return [...LATAM]
  return [value]
}

export interface ParsedLocations {
  countries: string[]   // display names; empty = any
  cities: string[]
}

/** "MX", "Mexico", "LATAM", "Remote", "Mexico City, Mexico", "Guadalajara,Jalisco,MX". */
export function parseLocations(locations: unknown): ParsedLocations {
  const countries = new Set<string>()
  const cities = new Set<string>()
  for (const raw of Array.isArray(locations) ? locations : []) {
    if (typeof raw !== 'string') continue
    const v = raw.trim()
    if (!v) continue
    const lower = normKey(v)
    if (lower === 'remote' || lower === 'anywhere' || lower === 'global') continue
    if (lower === 'latam' || lower === 'latin america' || lower === 'latinoamerica') {
      LATAM.forEach((c) => countries.add(c))
      continue
    }
    const parts = v.split(',').map((p) => p.trim()).filter(Boolean)
    const country = countryName(parts[parts.length - 1])
    if (country) countries.add(country)
    if (parts.length >= 2) cities.add(parts[0])
  }
  return { countries: [...countries], cities: [...cities] }
}

/** Apollo-style seniorities -> the values candidates.seniority_level holds. */
export function candidateSeniorities(seniorities: unknown): string[] {
  const map: Record<string, string[]> = {
    entry: ['entry', 'junior'], junior: ['junior', 'entry'], mid: ['mid'], senior: ['senior'],
    manager: ['lead', 'senior'], lead: ['lead'], director: ['director'], head: ['director'],
    vp: ['vp'], c_suite: ['c_level'], executive: ['c_level', 'vp'], 'c-suite': ['c_level'],
  }
  const out = new Set<string>()
  for (const s of Array.isArray(seniorities) ? seniorities : []) {
    if (typeof s !== 'string') continue
    for (const v of map[s.toLowerCase()] ?? [s.toLowerCase()]) out.add(v)
  }
  return [...out]
}

/** Companies the person named (a hard filter); older projects use company_names. */
export function targetCompanies(criteria: any): string[] {
  const named = [...(criteria?.user_company_names ?? []), ...(criteria?.company_names ?? [])]
  const seen = new Set<string>()
  return named.filter((n: unknown): n is string => {
    if (typeof n !== 'string' || !n.trim()) return false
    const k = n.trim().toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const STOP = new Set(['and', 'of', 'the', 'de', 'y', 'la', 'el', 'en', 'for', 'to', 'a', 'sr', 'jr'])

export interface FitInput {
  title?: string | null
  company?: string | null
  country?: string | null
  city?: string | null
  seniority?: string | null
  text?: string | null        // headline, summary, skills: anything keywords can hit
}

export interface Fit { score: number; tier: 'excellent' | 'good' | 'fair' | 'minimal'; reasons: string[] }

export function fitScore(p: FitInput, criteria: any, loc: ParsedLocations, seniorities: string[], companies: string[]): Fit {
  const reasons: string[] = []
  const title = normKey(p.title)
  const titles: string[] = (criteria?.title_keywords ?? []).map((t: string) => normKey(t)).filter(Boolean)

  // Title (45)
  let titlePts = 0
  if (titles.length === 0) titlePts = 25
  else if (title) {
    for (const t of titles) {
      if (title === t) { titlePts = 45; break }
      if (title.includes(t)) titlePts = Math.max(titlePts, 40)
      const words = t.split(' ').filter((w) => w.length > 1 && !STOP.has(w))
      const hit = words.filter((w) => title.split(' ').includes(w)).length
      if (words.length > 0 && hit === words.length) titlePts = Math.max(titlePts, 35)
      else if (hit > 0) titlePts = Math.max(titlePts, Math.round(10 + 15 * hit / words.length))
    }
  }
  if (titlePts >= 35 && titles.length > 0) reasons.push('Title matches')

  // Location (25)
  let locPts = 25
  if (loc.countries.length > 0) {
    const want = loc.countries.map(normKey)
    if (!p.country) locPts = 12
    else if (want.includes(normKey(countryName(p.country) ?? p.country))) {
      locPts = 20
      if (loc.cities.length > 0 && p.city && loc.cities.map(normKey).includes(normKey(p.city))) locPts = 25
      else if (loc.cities.length === 0) locPts = 25
      reasons.push('In location')
    } else locPts = 0
  }

  // Seniority (15)
  let senPts = 15
  if (seniorities.length > 0) {
    if (!p.seniority) senPts = 7
    else if (seniorities.includes(p.seniority.toLowerCase())) { senPts = 15; reasons.push('Seniority fits') }
    else senPts = 0
  }

  // Keywords or target company (15)
  let kwPts = 15
  const keywords: string[] = (criteria?.keywords ?? []).map((k: string) => normKey(k)).filter(Boolean)
  if (companies.length > 0) {
    const atTarget = !!p.company && companies.map(normKey).includes(normKey(p.company))
    kwPts = atTarget ? 15 : 0
    if (atTarget) reasons.push('At a target company')
  } else if (keywords.length > 0) {
    const hay = normKey([p.title, p.company, p.text].filter(Boolean).join(' '))
    const hits = keywords.filter((k) => hay.includes(k)).length
    kwPts = Math.round(15 * Math.min(1, hits / Math.min(keywords.length, 2)))
    if (hits > 0) reasons.push(`${hits} keyword${hits > 1 ? 's' : ''}`)
  }

  const score = Math.max(0, Math.min(100, titlePts + locPts + senPts + kwPts))
  const tier = score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 55 ? 'fair' : 'minimal'
  return { score, tier, reasons }
}


// ---------------------------------------------------------------------------
// Find, 2026-10-22 (Allan): skills in tiers, an honest match.
//
// People with a profile (ours, PDL) get a search match out of 100 from what the
// profile shows: title 35, location 20, seniority 10, skills 35 (target
// companies, when named, take 10 of the skills' share). Must-have skills work as
// in Gio Fit: one missing caps the match at 79, two or more at 70.
// Apollo previews carry only a name, title and company, so they get no number:
// previewChecks() says what was checked (the title, by us) and what Apollo
// filtered on (place, seniority), and that skills are checked once added.
// ---------------------------------------------------------------------------

export type SkillTier = 'must' | 'nice' | 'extra'
export interface SkillTiers { must: string[]; nice: string[]; extra: string[] }

/**
 * The search's skills by tier. criteria.skills with criteria.skill_priorities
 * (must / nice / bonus, as on jobs); older searches' keywords count as nice.
 */
export function skillTiers(criteria: any): SkillTiers {
  const out: SkillTiers = { must: [], nice: [], extra: [] }
  const seen = new Set<string>()
  const pr: Record<string, string> = criteria?.skill_priorities && typeof criteria.skill_priorities === 'object' ? criteria.skill_priorities : {}
  const add = (raw: unknown, tier: SkillTier) => {
    if (typeof raw !== 'string') return
    const v = raw.trim()
    const k = normKey(v)
    if (!v || !k || seen.has(k)) return
    seen.add(k)
    out[tier].push(v)
  }
  for (const s of Array.isArray(criteria?.skills) ? criteria.skills : []) {
    const p = typeof s === 'string' ? pr[s] : undefined
    add(s, p === 'must' ? 'must' : p === 'bonus' || p === 'extra' ? 'extra' : 'nice')
  }
  for (const k of Array.isArray(criteria?.keywords) ? criteria.keywords : []) add(k, 'nice')
  return out
}

/** Every skill of the search, for the internal full-text query. */
export function allSkills(t: SkillTiers): string[] {
  return [...t.must, ...t.nice, ...t.extra]
}

const LEGAL = new Set(['inc', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'co', 'sa', 'sas', 'srl', 'gmbh', 'plc', 'bv', 'ag', 'pty', 'sl', 'spa', 'ab', 'oy', 'as', 'nv', 'lp', 'llp', 'pte'])

/** A company name without legal suffixes, folded: "Salesforce, Inc." -> "salesforce". */
export function companyKey(name: string | null | undefined): string {
  const words = normKey(name).split(' ').filter(Boolean)
  while (words.length > 1 && LEGAL.has(words[words.length - 1])) words.pop()
  return words.join(' ')
}

/** Same company, allowing suffixes and a longer form ("Acme" ~ "Acme Payroll Group"). */
export function sameCompany(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = companyKey(a)
  const y = companyKey(b)
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length >= 4 && (long.startsWith(short + ' ') || long.endsWith(' ' + short))
}

const SKILL_STOP = new Set([...STOP, 'with', 'in', 'on', 'or', 'experience', 'skills', 'knowledge'])

function stemWords(s: string): string[] {
  return normKey(s).split(' ').filter((w) => w.length > 1 && !SKILL_STOP.has(w))
}

/**
 * Whether a skill shows in the text. "Canvas or Moodle" matches either side;
 * every significant word must appear, and words of 5+ letters match on their
 * first 5 ("onboarding" ~ "onboarded", "analytics" ~ "analytical").
 */
export function skillInText(skill: string, haystackWords: Set<string>, haystackPrefixes: Set<string>): boolean {
  const alternatives = skill.split(/\s+or\s+|\s*\/\s*|,\s*/i).map((a) => a.trim()).filter(Boolean)
  return alternatives.some((alt) => {
    const words = stemWords(alt)
    if (!words.length) return false
    return words.every((w) => haystackWords.has(w) || (w.length >= 5 && haystackPrefixes.has(w.slice(0, 5))))
  })
}

export function textIndex(text: string): { words: Set<string>; prefixes: Set<string> } {
  const words = new Set(normKey(text).split(' ').filter(Boolean))
  const prefixes = new Set([...words].filter((w) => w.length >= 5).map((w) => w.slice(0, 5)))
  return { words, prefixes }
}

function titlePoints(title: string | null | undefined, criteria: any, max: number): number {
  const t = normKey(title)
  const titles: string[] = (criteria?.title_keywords ?? []).map((x: string) => normKey(x)).filter(Boolean)
  if (titles.length === 0) return Math.round(max * 0.55)
  if (!t) return 0
  let pts = 0
  for (const want of titles) {
    if (t === want) return max
    if (t.includes(want)) pts = Math.max(pts, Math.round(max * 0.89))
    const words = want.split(' ').filter((w) => w.length > 1 && !STOP.has(w))
    const tw = t.split(' ')
    const hit = words.filter((w) => tw.includes(w)).length
    if (words.length > 0 && hit === words.length) pts = Math.max(pts, Math.round(max * 0.78))
    else if (hit > 0) pts = Math.max(pts, Math.round(max * (0.22 + 0.33 * hit / words.length)))
  }
  return pts
}

export interface MatchInput {
  title?: string | null
  company?: string | null
  country?: string | null
  city?: string | null
  seniority?: string | null
  /** Everything a skill can show in: summary, bio, skills, past titles and descriptions. */
  text?: string | null
}

export interface MatchedSkill { skill: string; tier: SkillTier }

export interface SearchMatch {
  score: number
  tier: 'excellent' | 'good' | 'fair' | 'minimal'
  reasons: string[]
  matched_skills: MatchedSkill[]
  missing_must: string[]
  must_total: number
}

export interface MatchContext {
  loc: ParsedLocations
  seniorities: string[]
  companies: string[]
  tiers: SkillTiers
}

export function matchContext(criteria: any): MatchContext {
  return {
    loc: parseLocations(criteria?.locations),
    seniorities: candidateSeniorities(criteria?.seniorities),
    companies: targetCompanies(criteria),
    tiers: skillTiers(criteria),
  }
}

/** The search match for someone with a profile (ours or PDL). */
export function searchMatch(p: MatchInput, criteria: any, ctx: MatchContext): SearchMatch {
  const reasons: string[] = []
  const { loc, seniorities, companies, tiers } = ctx

  // Title (35)
  const titlePts = titlePoints(p.title, criteria, 35)
  if (titlePts >= 27 && (criteria?.title_keywords ?? []).length) reasons.push('Title matches')

  // Location (20)
  let locPts = 20
  if (loc.countries.length > 0) {
    const want = loc.countries.map(normKey)
    if (!p.country) locPts = 10
    else if (want.includes(normKey(countryName(p.country) ?? p.country))) {
      locPts = loc.cities.length === 0 || (p.city && loc.cities.map(normKey).includes(normKey(p.city))) ? 20 : 16
      reasons.push('In location')
    } else locPts = 0
  }

  // Seniority (10)
  let senPts = 10
  if (seniorities.length > 0) {
    if (!p.seniority) senPts = 5
    else if (seniorities.includes(p.seniority.toLowerCase())) { senPts = 10; reasons.push('Seniority fits') }
    else senPts = 0
  }

  // Skills (35, or 25 when target companies take 10)
  const companyShare = companies.length > 0 ? 10 : 0
  const skillShare = 35 - companyShare
  const idx = textIndex([p.title, p.company, p.text].filter(Boolean).join(' '))
  const matched: MatchedSkill[] = []
  const hits = (list: string[], tier: SkillTier) => {
    let n = 0
    for (const s of list) if (skillInText(s, idx.words, idx.prefixes)) { n++; matched.push({ skill: s, tier }) }
    return n
  }
  const mustHit = hits(tiers.must, 'must')
  const niceHit = hits(tiers.nice, 'nice')
  const extraHit = hits(tiers.extra, 'extra')
  const missing_must = tiers.must.filter((s) => !matched.some((m) => m.skill === s))
  let skillPts = skillShare
  const weights: [number, number][] = []
  if (tiers.must.length) weights.push([2, mustHit / tiers.must.length])
  if (tiers.nice.length) weights.push([1, Math.min(1, niceHit / Math.min(tiers.nice.length, 3))])
  if (weights.length) {
    const w = weights.reduce((a, [x]) => a + x, 0)
    skillPts = Math.round(skillShare * weights.reduce((a, [x, r]) => a + x * r, 0) / w)
  }
  const extraPts = tiers.extra.length ? Math.round(5 * Math.min(1, extraHit / Math.min(tiers.extra.length, 2))) : 0
  if (tiers.must.length) reasons.push(`${mustHit} of ${tiers.must.length} must-haves`)
  if (niceHit) reasons.push(`${niceHit} nice-to-have${niceHit > 1 ? 's' : ''}`)
  if (extraHit) reasons.push(`${extraHit} extra`)

  // Target companies (10 when named)
  let companyPts = 0
  if (companyShare) {
    const atTarget = companies.some((c) => sameCompany(c, p.company))
    companyPts = atTarget ? companyShare : 0
    if (atTarget) reasons.push('At a target company')
  }

  let score = Math.max(0, Math.min(100, titlePts + locPts + senPts + skillPts + companyPts + extraPts))
  // Must-haves work as in Gio Fit.
  if (missing_must.length >= 2) score = Math.min(score, 70)
  else if (missing_must.length === 1) score = Math.min(score, 79)
  const tier = score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 55 ? 'fair' : 'minimal'
  return { score, tier, reasons, matched_skills: matched, missing_must, must_total: tiers.must.length }
}

export type CheckState = 'yes' | 'close' | 'no' | 'apollo' | 'later'
export interface PreviewChecks {
  title: CheckState | null
  place: CheckState | null
  seniority: CheckState | null
  skills: CheckState | null
  company: CheckState | null
  /** For ordering previews among themselves only; never shown as a score. */
  rank: number
}

/**
 * What can be said about an Apollo preview. The title (and company, when named)
 * is checked here; place and seniority were filtered by Apollo when the search
 * sent them; skills wait until the person is added and their profile read.
 */
export function previewChecks(p: { title?: string | null; company?: string | null }, criteria: any, ctx: MatchContext, sent: { place: boolean; seniority: boolean }): PreviewChecks {
  const hasTitles = (criteria?.title_keywords ?? []).length > 0
  const t = titlePoints(p.title, criteria, 100)
  const title: CheckState | null = !hasTitles ? null : t >= 78 ? 'yes' : t >= 40 ? 'close' : 'no'
  const company: CheckState | null = ctx.companies.length
    ? (ctx.companies.some((c) => sameCompany(c, p.company)) ? 'yes' : 'no')
    : null
  return {
    title,
    place: sent.place ? 'apollo' : null,
    seniority: sent.seniority ? 'apollo' : null,
    skills: allSkills(ctx.tiers).length ? 'later' : null,
    company,
    rank: t + (company === 'yes' ? 10 : 0),
  }
}
