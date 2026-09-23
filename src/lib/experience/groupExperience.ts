export type DatePrecision = 'month' | 'year'

export interface ExperienceItem {
  id: string
  company_id?: string | null
  company_name: string
  company_logo_url?: string | null
  title?: string | null
  job_title?: string | null
  location?: string | null
  start_date?: string | null
  end_date?: string | null
  is_current?: boolean | null
  start_precision?: DatePrecision | null
  description?: string | null
  supports?: Array<{ label: string; colorClass?: string }>
}

export interface ExperienceGroup<T extends ExperienceItem = ExperienceItem> {
  companyKey: string
  company: string
  logoUrl: string | null
  entries: T[]
  start: string | null
  end: string | null
  months: number
  durationText: string
  spanText: string
  locations: string[]
  current: boolean
  stints: number
  stint: number
  returning: boolean
  awayText: string | null
  yearPrecision: boolean
}

const LEGAL_SUFFIX = /(?:\s|,)+(?:inc\.?|ltd\.?|llc\.?|gmbh\.?|s\.?\s*a\.?|s\.?\s*l\.?|srl\.?|spa\.?|b\.?\s*v\.?|a\.?\s*g\.?|plc\.?|co\.?)$/i

function validDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function monthIndex(value?: string | null) {
  const date = validDate(value)
  return date ? date.getUTCFullYear() * 12 + date.getUTCMonth() : null
}

function year(value?: string | null) {
  return validDate(value)?.getUTCFullYear() ?? null
}

function monthLabel(value?: string | null, precision: DatePrecision = 'month') {
  const date = validDate(value)
  if (!date) return ''
  if (precision === 'year') return String(date.getUTCFullYear())
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function companyKey(item: Pick<ExperienceItem, 'company_id' | 'company_name'>) {
  if (item.company_id?.trim()) return `id:${item.company_id.trim().toLocaleLowerCase()}`
  let name = item.company_name.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
  let previous = ''
  while (name !== previous) {
    previous = name
    name = name.replace(LEGAL_SUFFIX, '').trim()
  }
  name = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  return `name:${name}`
}

function inclusiveMonths(start?: string | null, end?: string | null) {
  const startMonth = monthIndex(start)
  const endMonth = end ? monthIndex(end) : monthIndex(new Date().toISOString())
  if (startMonth === null || endMonth === null || endMonth < startMonth) return 0
  return endMonth - startMonth + 1
}

export function formatExperienceDuration(months: number, yearPrecision = false) {
  if (months <= 0) return ''
  if (yearPrecision) {
    const years = Math.max(1, Math.round(months / 12))
    return `${years} yr${years === 1 ? '' : 's'}`
  }
  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (!years) return `${remainder}m`
  return `${years}y${remainder ? ` ${remainder}m` : ''}`
}

function roleTitle(item: ExperienceItem) {
  return item.title?.trim() || item.job_title?.trim() || ''
}

export function formatRoleDates(item: ExperienceItem) {
  const precision = item.start_precision ?? 'month'
  const current = item.is_current === true || !item.end_date
  const start = monthLabel(item.start_date, precision)
  const end = current ? 'Present' : monthLabel(item.end_date, precision)
  const duration = formatExperienceDuration(inclusiveMonths(item.start_date, current ? null : item.end_date), precision === 'year')
  return [[start, end].filter(Boolean).join(' — '), duration].filter(Boolean).join(' · ')
}

function hasRealBreak<T extends ExperienceItem>(newerOldest: T, older: T) {
  if (!newerOldest.start_date || !older.end_date) return false
  if (newerOldest.start_precision === 'year' || older.start_precision === 'year') {
    const newerStartYear = year(newerOldest.start_date)
    const olderEndYear = year(older.end_date)
    return newerStartYear !== null && olderEndYear !== null && newerStartYear - olderEndYear > 1
  }
  const newerStart = monthIndex(newerOldest.start_date)
  const olderEnd = monthIndex(older.end_date)
  return newerStart !== null && olderEnd !== null && newerStart - olderEnd - 1 > 3
}

function newestFirst<T extends ExperienceItem>(items: T[]) {
  return [...items].sort((a, b) => {
    const aEnd = a.is_current || !a.end_date ? Number.POSITIVE_INFINITY : monthIndex(a.end_date) ?? Number.NEGATIVE_INFINITY
    const bEnd = b.is_current || !b.end_date ? Number.POSITIVE_INFINITY : monthIndex(b.end_date) ?? Number.NEGATIVE_INFINITY
    if (aEnd !== bEnd) return bEnd - aEnd
    return (monthIndex(b.start_date) ?? Number.NEGATIVE_INFINITY) - (monthIndex(a.start_date) ?? Number.NEGATIVE_INFINITY)
  })
}

export function groupExperience<T extends ExperienceItem>(items: T[]): ExperienceGroup<T>[] {
  const groups: ExperienceGroup<T>[] = []
  for (const entry of newestFirst(items)) {
    const key = companyKey(entry)
    const previous = groups.at(-1)
    const previousOldest = previous?.entries.at(-1)
    if (previous && previous.companyKey === key && previousOldest && !hasRealBreak(previousOldest, entry)) {
      previous.entries.push(entry)
      continue
    }
    groups.push({
      companyKey: key,
      company: entry.company_name,
      logoUrl: entry.company_logo_url ?? null,
      entries: [entry],
      start: null,
      end: null,
      months: 0,
      durationText: '',
      spanText: '',
      locations: [],
      current: false,
      stints: 1,
      stint: 1,
      returning: false,
      awayText: null,
      yearPrecision: false,
    })
  }

  for (const group of groups) {
    const oldest = group.entries.at(-1)
    const newest = group.entries[0]
    group.start = oldest?.start_date ?? null
    group.current = group.entries.some((entry) => entry.is_current === true || !entry.end_date)
    group.end = group.current ? null : newest?.end_date ?? null
    group.yearPrecision = group.entries.some((entry) => entry.start_precision === 'year')
    group.months = inclusiveMonths(group.start, group.end)
    group.durationText = formatExperienceDuration(group.months, group.yearPrecision)
    group.spanText = [
      [monthLabel(group.start, group.yearPrecision ? 'year' : 'month'), group.current ? 'Present' : monthLabel(group.end, group.yearPrecision ? 'year' : 'month')].filter(Boolean).join(' — '),
      group.durationText,
    ].filter(Boolean).join(' · ')
    group.locations = [...new Set(group.entries.map((entry) => entry.location?.trim()).filter((value): value is string => Boolean(value)))]
  }

  const byCompany = new Map<string, ExperienceGroup<T>[]>()
  for (const group of groups) byCompany.set(group.companyKey, [...(byCompany.get(group.companyKey) ?? []), group])
  for (const companyGroups of byCompany.values()) {
    const total = companyGroups.length
    companyGroups.forEach((group, newestIndex) => {
      group.stints = total
      group.stint = total - newestIndex
      group.returning = total > 1 && group.stint > 1
      if (!group.returning) return
      const older = companyGroups[newestIndex + 1]
      const start = monthIndex(group.start)
      const previousEnd = monthIndex(older?.end)
      if (start === null || previousEnd === null) return
      const awayMonths = Math.max(0, start - previousEnd - 1)
      group.awayText = awayMonths >= 2 ? formatExperienceDuration(awayMonths, group.yearPrecision || Boolean(older?.yearPrecision)) : null
    })
  }
  return groups
}

export function unionExperienceMonths(items: ExperienceItem[]) {
  const ranges = items.flatMap((item) => {
    const start = monthIndex(item.start_date)
    const end = item.is_current || !item.end_date ? monthIndex(new Date().toISOString()) : monthIndex(item.end_date)
    return start !== null && end !== null && end >= start ? [[start, end] as const] : []
  }).sort((a, b) => a[0] - b[0])
  if (!ranges.length) return 0
  let total = 0
  let [start, end] = ranges[0]
  for (const [nextStart, nextEnd] of ranges.slice(1)) {
    if (nextStart <= end + 1) end = Math.max(end, nextEnd)
    else {
      total += end - start + 1
      start = nextStart
      end = nextEnd
    }
  }
  return total + end - start + 1
}

export function experienceSummary(items: ExperienceItem[]) {
  const roles = items.length
  if (!roles) return 'No experience added yet'
  const companies = new Set(items.map(companyKey)).size
  const months = unionExperienceMonths(items)
  const years = months > 0 ? Math.max(1, Math.round(months / 12)) : 0
  return [
    `${roles} role${roles === 1 ? '' : 's'}`,
    ...(companies !== roles ? [`${companies} ${companies === 1 ? 'company' : 'companies'}`] : []),
    ...(years ? [`${years} ${years === 1 ? 'year' : 'years'} total`] : []),
  ].join(' · ')
}

export function getExperienceTitle(item: ExperienceItem) {
  return roleTitle(item)
}
