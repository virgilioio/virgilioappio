// Tenure & progression (2026-10-14, Allan's rubric).
//
// Computed from candidate_work_experience, never from the model's impression.
// Roles are grouped into company stints; each stint and role is measured;
// promotions are roles inside one stint whose title ranks higher than the one
// before. The flag sets the score band the dimension must land in:
//
//   red     2+ stints under 10 months, consecutive or 3+ across the career,
//           not confined to the first two years                     20–35
//   yellow  job hopping that settled (every stint in the last three years
//           is 12+ months), or short stints without a clear pattern   55–65
//   green   stints and roles typically over 12 months                80–85
//   best    green plus a promotion inside the same company           90–100
//   unknown fewer than 12 months of datable history → score null
//
// A short stint the candidate explains as a layoff, acquisition, closure or a
// contract counts half. Internships and roles under three months are ignored.
// The current role is never a hop while it is under ten months.

export interface WorkRow {
  company_name?: string | null
  job_title?: string | null
  start_date?: string | null
  end_date?: string | null
  is_current?: boolean | null
  description?: string | null
}

export interface TenureRole { title: string; start: Date; end: Date; months: number; current: boolean; explained: boolean }
export interface TenureStint { company: string; display: string; roles: TenureRole[]; start: Date; end: Date; months: number; current: boolean; short: boolean; shortWeight: number; promotions: number; early: boolean }
export type TenureFlag = 'red' | 'yellow' | 'green' | 'best' | 'unknown'

export interface TenureAnalysis {
  flag: TenureFlag
  band: [number, number] | null
  stints: TenureStint[]
  medianStintMonths: number | null
  medianRoleMonths: number | null
  shortStints: number
  promotions: number
  /** Plain-English facts for the prompt and the dossier. */
  facts: string
  label: string
}

const BANDS: Record<Exclude<TenureFlag, 'unknown'>, [number, number]> = {
  red: [20, 35], yellow: [55, 65], green: [80, 85], best: [90, 100],
}

const LABELS: Record<TenureFlag, string> = {
  red: 'Job-hopping pattern',
  yellow: 'Settled after early moves',
  green: 'Stable tenures',
  best: 'Stable tenures with promotion',
  unknown: 'Not enough dated history',
}

const INTERN = /\b(intern|internship|trainee|practicante|becari[oa]|estagi[áa]ri[oa]|werkstudent|stagiaire)\b/i
const EXPLAINED = /\b(laid off|layoff|lay-off|redundan|downsiz|restructur|acqui|merger|merged|shut ?down|closed|closure|wound down|bankrupt|insolven|contract|contractor|freelance|consultan|interim|temporary|fixed[- ]term|project[- ]based|despido|recorte|liquidaci|cierre|adquisici|contrato temporal|por proyecto)\b/i

const RANK: [RegExp, number][] = [
  [/\b(chief|c[a-z]o|ceo|cto|cfo|coo|cro|cmo|president|founder|co-?founder|partner|owner|vp|vice president|svp|evp|director|head of|head)\b/i, 5],
  [/\b(senior manager|group manager|principal|staff|distinguished)\b/i, 4],
  [/\b(manager|lead|supervisor|gerente|jefe|líder|lider)\b/i, 3],
  [/\b(senior|sr\.?|ii{1,2}\b|iii|specialist ii)\b/i, 2],
  [/\b(junior|jr\.?|associate|assistant|entry|trainee|intern|auxiliar|asistente)\b/i, 0],
]
const seniorityRank = (title: string) => {
  for (const [re, rank] of RANK) if (re.test(title)) return rank
  return 1
}

const normCompany = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|sa|s\.a\.|de cv|s de rl|sas|gmbh|plc|group|holdings?)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const monthsBetween = (a: Date, b: Date) => Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1))
const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const fmtMonths = (m: number) => {
  const y = Math.floor(m / 12), r = m % 12
  return y && r ? `${y}y ${r}m` : y ? `${y}y` : `${r}m`
}

export function analyseTenure(rows: WorkRow[], now = new Date()): TenureAnalysis {
  const roles: (TenureRole & { company: string; display: string })[] = []
  for (const r of rows) {
    const title = String(r.job_title || '').trim()
    const start = parseDate(r.start_date)
    if (!start || start > now) continue
    const current = Boolean(r.is_current) || !r.end_date
    const end = current ? now : (parseDate(r.end_date) ?? now)
    if (end < start) continue
    const months = monthsBetween(start, end)
    if (INTERN.test(title)) continue
    if (months < 3 && !current) continue
    roles.push({
      title, start, end, months, current,
      explained: EXPLAINED.test(`${title} ${r.description || ''}`),
      company: normCompany(String(r.company_name || '')) || '?',
      display: String(r.company_name || '').trim() || 'Unknown employer',
    })
  }
  roles.sort((a, b) => a.start.getTime() - b.start.getTime())

  // Group consecutive roles at the same employer (≤3 months apart) into stints.
  const stints: TenureStint[] = []
  for (const role of roles) {
    const last = stints[stints.length - 1]
    if (last && last.company === role.company && monthsBetween(last.end, role.start) <= 3) {
      last.roles.push(role)
      if (role.end > last.end) last.end = role.end
      last.current = last.current || role.current
    } else {
      stints.push({ company: role.company, display: role.display, roles: [role], start: role.start, end: role.end, months: 0, current: role.current, short: false, shortWeight: 0, promotions: 0, early: false })
    }
  }
  if (!stints.length) return empty('unknown', stints)

  const careerStart = stints[0].start
  const careerMonths = monthsBetween(careerStart, now)
  for (const s of stints) {
    s.months = monthsBetween(s.start, s.end)
    s.early = monthsBetween(careerStart, s.start) < 24
    s.short = !s.current && s.months < 10
    s.shortWeight = s.short ? (s.roles.some((r) => r.explained) ? 0.5 : 1) : 0
    for (let i = 1; i < s.roles.length; i++) {
      if (seniorityRank(s.roles[i].title) > seniorityRank(s.roles[i - 1].title)) s.promotions++
    }
  }
  const total = stints.reduce((n, s) => n + s.months, 0)
  if (total < 12 || careerMonths < 12) return empty('unknown', stints)

  const shortStints = stints.reduce((n, s) => n + s.shortWeight, 0)
  const consecutiveShort = stints.some((s, i) => i > 0 && s.short && stints[i - 1].short)
  // Explained stints count half, so a layoff next to one real hop is not yet a pattern.
  const pattern = shortStints >= 3 || (shortStints >= 2 && (consecutiveShort || stints.length <= 4))
  const allShortsEarly = stints.filter((s) => s.short).every((s) => s.early)
  const recent = stints.filter((s) => monthsBetween(s.end, now) <= 36)
  const recentStable = recent.length > 0 && recent.every((s) => s.current || s.months >= 12)
  const medianStint = median(stints.map((s) => s.months))
  const medianRole = median(stints.flatMap((s) => s.roles.map((r) => r.months)))
  const promotions = stints.reduce((n, s) => n + s.promotions, 0)

  let flag: TenureFlag
  // A pattern is red until it has visibly settled: no stint under 12 months
  // in the last three years (a current role is given the benefit of the doubt).
  if (pattern && !recentStable) flag = 'red'
  else if (pattern || shortStints >= 1.5) flag = 'yellow'
  else if ((medianStint ?? 0) >= 12 && (medianRole ?? 0) >= 12) flag = promotions > 0 ? 'best' : 'green'
  else if ((medianStint ?? 0) >= 12 && stints.length === 1) flag = promotions > 0 ? 'best' : 'green'
  else flag = 'yellow'

  const lines = stints.slice().reverse().map((s) => {
    const titles = s.roles.map((r) => r.title || 'untitled').join(' → ')
    const bits = [`${fmtMonths(s.months)}${s.current ? ', current' : ''}`]
    if (s.roles.length > 1) bits.push(`${s.roles.length} roles: ${titles}`)
    if (s.promotions) bits.push(`${s.promotions} promotion${s.promotions > 1 ? 's' : ''}`)
    if (s.short) bits.push(s.shortWeight < 1 ? 'short, explained' : 'short')
    return `- ${s.display}: ${bits.join('; ')}`
  })
  const summary = [
    `${stints.length} employer${stints.length > 1 ? 's' : ''} over ${fmtMonths(careerMonths)}`,
    medianStint != null ? `typical stint ${fmtMonths(Math.round(medianStint))}` : null,
    medianRole != null ? `typical role ${fmtMonths(Math.round(medianRole))}` : null,
    `${Math.ceil(shortStints)} stint${shortStints === 1 ? '' : 's'} under 10 months${allShortsEarly && shortStints ? ' (all in the first two years)' : ''}`,
    `${promotions} promotion${promotions === 1 ? '' : 's'} within an employer`,
  ].filter(Boolean).join(' · ')

  return {
    flag, band: BANDS[flag], stints, medianStintMonths: medianStint, medianRoleMonths: medianRole,
    shortStints, promotions, label: LABELS[flag],
    facts: `${summary}\n${lines.join('\n')}`,
  }
}

function empty(flag: 'unknown', stints: TenureStint[]): TenureAnalysis {
  return { flag, band: null, stints, medianStintMonths: null, medianRoleMonths: null, shortStints: 0, promotions: 0, label: LABELS[flag], facts: 'Fewer than 12 months of dated work history; tenure cannot be judged.' }
}
