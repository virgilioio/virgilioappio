import type { DimensionId } from '../model/types'

/**
 * Intelligence (Find Phase 4, 2026-10-12): the market view of the whole
 * talent database. One row per person comes from market_talent_rows(); these
 * helpers turn a row into the values a widget groups by. Pure functions, so
 * the widgets and the CSV export agree.
 */
export interface MarketRow {
  id: string
  country: string | null
  state: string | null
  city: string | null
  title: string | null
  role_family: string | null
  specialization: string | null
  seniority: string | null
  company: string | null
  years_experience: number | null
  skills: string[] | null
  source: string | null
  created_at: string
  /** Per month, in the workspace's base currency. */
  salary_month_base: number | null
  base_currency?: string
  in_pipeline: boolean
}

export interface MarketSelection {
  dimension: DimensionId
  value: string
}

/** Never show a salary figure built from fewer salaries than this. */
export const MIN_SALARIES = 5

export const SENIORITY_LABEL: Record<string, string> = {
  entry: 'Entry',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead / manager',
  director: 'Director',
  vp: 'VP',
  c_level: 'C-level',
}
const SENIORITY_ORDER = Object.values(SENIORITY_LABEL)

export const EXPERIENCE_BANDS = ['0–2 yrs', '3–5 yrs', '6–10 yrs', '11–15 yrs', '16+ yrs']

function experienceBand(years: number | null): string | null {
  if (years === null || years === undefined || years < 0) return null
  if (years <= 2) return EXPERIENCE_BANDS[0]
  if (years <= 5) return EXPERIENCE_BANDS[1]
  if (years <= 10) return EXPERIENCE_BANDS[2]
  if (years <= 15) return EXPERIENCE_BANDS[3]
  return EXPERIENCE_BANDS[4]
}

const COMPANY_SUFFIX = /[,.]?\s*\b(inc|llc|ltd|corp|corporation|co|company|s\.?\s?a\.?(\s*de\s*c\.?\s?v\.?)?|s\.?a\.?p\.?i\.?|gmbh|plc|pty|limited|incorporated|group|holdings)\b\.?$/i

/** "Acme, Inc." and "ACME" count as one company. */
export function companyLabel(name: string | null | undefined): string | null {
  if (!name) return null
  let cleaned = name.trim()
  let prev = ''
  while (prev !== cleaned) {
    prev = cleaned
    cleaned = cleaned.replace(COMPANY_SUFFIX, '').trim()
  }
  cleaned = cleaned.replace(/[,.\-–]+$/, '').trim()
  if (!cleaned) return name.trim() || null
  // Keep a brand's own casing unless it's all one case.
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    return cleaned.split(/\s+/).map(w => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ')
  }
  return cleaned
}

const SOURCE_LABEL: Record<string, string> = {
  apollo: 'Apollo',
  linkedin_extension: 'LinkedIn extension',
  public_posting: 'Careers page',
  'direct application': 'Careers page',
  'virgilio career page': 'Careers page',
  direct: 'Added by hand',
  csv_import: 'Import',
  job_import: 'Import',
  import: 'Import',
  pdl: 'People Data Labs',
  coresignal: 'CoreSignal',
  talent: 'Talent.com',
  'talent.com': 'Talent.com',
  'occ mundial': 'OCC',
  'occ.com.mx': 'OCC',
}

function sourceLabel(source: string | null): string | null {
  if (!source) return null
  return SOURCE_LABEL[source.trim().toLowerCase()] ?? source.trim()
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export interface SalaryBands {
  /** Upper bounds per month in base currency; the last band is open. */
  edges: number[]
  labels: string[]
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * pow
}

function compact(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/** Six even, round bands across the middle 90% of salaries. */
export function salaryBands(salaries: number[], currency: string): SalaryBands {
  if (salaries.length < MIN_SALARIES) return { edges: [], labels: [] }
  const sorted = [...salaries].sort((a, b) => a - b)
  const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))]
  const step = niceStep(p95 / 6)
  const edges = Array.from({ length: 5 }, (_, i) => step * (i + 1))
  const labels = [
    `Under ${currency} ${compact(edges[0])} / mo`,
    ...edges.slice(1).map((e, i) => `${currency} ${compact(edges[i])}–${compact(e)} / mo`),
    `${currency} ${compact(edges[edges.length - 1])}+ / mo`,
  ]
  return { edges, labels }
}

function bandOf(value: number | null, bands: SalaryBands): string | null {
  if (value === null || bands.edges.length === 0) return null
  const i = bands.edges.findIndex(e => value < e)
  return bands.labels[i === -1 ? bands.labels.length - 1 : i]
}

export interface ValueContext {
  pastCompanies: Map<string, string[]>
  bands: SalaryBands
}

/** The values one person has for a dimension (several for skills and past companies). */
export function valuesOf(row: MarketRow, dim: DimensionId, ctx: ValueContext): string[] {
  const one = (v: string | null | undefined) => (v ? [v] : [])
  switch (dim) {
    case 'mkt_country': return one(row.country)
    case 'mkt_city': return one(row.city)
    case 'mkt_role_family': return one(row.role_family)
    case 'mkt_title': return one(row.title)
    case 'mkt_specialization': return one(row.specialization)
    case 'mkt_seniority': return one(row.seniority ? SENIORITY_LABEL[row.seniority] ?? row.seniority : null)
    case 'mkt_company': return one(companyLabel(row.company))
    case 'mkt_past_company': return ctx.pastCompanies.get(row.id) ?? []
    case 'mkt_salary_band': return one(bandOf(row.salary_month_base, ctx.bands))
    case 'mkt_experience': return one(experienceBand(row.years_experience))
    case 'mkt_skills': return [...new Set((row.skills ?? []).map(s => s.trim()).filter(Boolean))]
    case 'mkt_source': return one(sourceLabel(row.source))
    case 'time': return one(monthLabel(row.created_at))
    default: return []
  }
}

/** Dimensions with a natural order sort by it; the rest by size. */
export function orderFor(dim: DimensionId, bands: SalaryBands): string[] | null {
  if (dim === 'mkt_seniority') return SENIORITY_ORDER
  if (dim === 'mkt_experience') return EXPERIENCE_BANDS
  if (dim === 'mkt_salary_band') return bands.labels
  return null
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const idx = (p / 100) * (s.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

/** People matching every selection (except on the given dimension). */
export function applySelections(
  rows: MarketRow[],
  selections: MarketSelection[],
  ctx: ValueContext,
  exceptDimension?: DimensionId,
): MarketRow[] {
  const active = selections.filter(s => s.dimension !== exceptDimension)
  if (active.length === 0) return rows
  // Values within one dimension are alternatives (OR); dimensions combine (AND).
  const byDim = new Map<DimensionId, Set<string>>()
  for (const s of active) {
    const set = byDim.get(s.dimension) ?? new Set<string>()
    set.add(s.value)
    byDim.set(s.dimension, set)
  }
  return rows.filter(r => [...byDim.entries()].every(([dim, wanted]) => valuesOf(r, dim, ctx).some(v => wanted.has(v))))
}
