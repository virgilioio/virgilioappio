/**
 * A sourcing project's criteria, read the same way for our own candidates
 * and for Apollo's, and the rule-based fit score Find ranks both by
 * (Find Phase 1, 2026-10-12).
 *
 * The fit score is deterministic and explainable: title 45, location 25,
 * seniority 15, keywords or target company 15. Tiers: 85+ excellent ("Top
 * match" territory), 70+ good, 55+ fair, else minimal — the same bands the
 * Find table colours by.
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

const NAME_ALIASES: Record<string, string> = {
  'méxico': 'Mexico', 'mexico': 'Mexico', 'perú': 'Peru', 'brasil': 'Brazil', 'usa': 'United States',
  'united states of america': 'United States', 'estados unidos': 'United States', 'españa': 'Spain',
  'colombia': 'Colombia', 'argentina': 'Argentina', 'chile': 'Chile', 'uk': 'United Kingdom',
}

/** Lower-case, accents folded, letters and spaces only (mirrors person_name_key in SQL). */
export function normKey(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countryName(part: string): string | null {
  const p = part.trim()
  if (!p) return null
  if (/^[A-Za-z]{2}$/.test(p)) return COUNTRY_CODE_TO_NAME[p.toUpperCase()] ?? null
  return NAME_ALIASES[p.toLowerCase()] ?? p
}

export interface ParsedLocations {
  countries: string[]   // display names; empty = any
  cities: string[]
}

/** "MX", "México", "LATAM", "Remote", "Mexico City, Mexico", "Guadalajara,Jalisco,MX". */
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

/** Apollo-style seniorities → the values candidates.seniority_level holds. */
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
