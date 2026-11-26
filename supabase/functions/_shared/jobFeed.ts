import { jujuJobType, talentJobType } from './employmentTypes.ts'
import { countryNameOf, postingReach } from './postingPlaces.ts'

/**
 * The job feed that boards read (Talent.com, Jooble, Careerjet, WhatJobs, Juju…),
 * built from a post (2026-11-26). One entry per place a board can list: a city or
 * country for an on-site or hybrid job, each country candidates can be in for a
 * remote one. A post no board could place, or with nothing to read, is held back
 * with its reason instead of being sent as "Remote, Remote". Pure, so the feed
 * and its tests agree.
 */

export const FEED_BOARDS = ['talent', 'jooble', 'adzuna', 'careerjet', 'jobrapido', 'whatjobs', 'juju'] as const
export type FeedBoard = (typeof FEED_BOARDS)[number]

export interface FeedPosting {
  id: string
  title: string
  slug: string
  description: string | null
  details: Record<string, unknown> | null
  created_at: string
  location: string | null
}

export interface FeedSalary {
  currency: string
  period: 'year' | 'month' | 'hour'
  min: number | null
  max: number | null
}

export interface FeedEntry {
  ref: string
  postingId: string
  title: string
  description: string
  city: string
  state: string
  /** English name, as boards read it. */
  country: string
  countryCode: string
  url: string
  /** ISO timestamp. */
  datePosted: string
  employmentType: unknown
  remote: boolean
  salary: FeedSalary | null
  language: string
}

export type HeldReason = 'no_description' | 'no_country'

const DAY = 86_400_000

/** A post still open after a month is listed as posted again, in 30-day steps (never a date in the future). */
export function postedDate(createdAt: string, now: Date): string {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return now.toISOString()
  const age = Math.floor((now.getTime() - created.getTime()) / DAY)
  if (age < 30) return created.toISOString()
  return new Date(created.getTime() + Math.floor(age / 30) * 30 * DAY).toISOString()
}

const plain = (html: string | null | undefined) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The range a post shows in public, or null (never a hidden range). */
export function feedSalary(details: Record<string, unknown> | null | undefined): FeedSalary | null {
  const d = details ?? {}
  const shown = d.show_salary_public === true || d.show_salary_public === 'true'
  if (!shown) return null
  const min = num(d.salary_min)
  const max = num(d.salary_max)
  const currency = typeof d.salary_currency === 'string' && /^[A-Za-z]{3}$/.test(d.salary_currency.trim()) ? d.salary_currency.trim().toUpperCase() : ''
  if (!currency || (min === null && max === null)) return null
  const raw = String(d.salary_period ?? 'annually').toLowerCase()
  const period = raw.includes('hour') ? 'hour' : raw.includes('month') ? 'month' : 'year'
  return { currency, period, min, max }
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** What a board gets for one post: its entries, or why it's held back. */
export function feedEntries(
  posting: FeedPosting,
  opts: { board: FeedBoard; jobUrl: string; now: Date },
): { entries: FeedEntry[]; held: HeldReason | null } {
  const d = posting.details ?? {}
  if (plain(posting.description).length < 100) return { entries: [], held: 'no_description' }
  const reach = postingReach({
    location: (typeof d.location === 'string' && d.location) || posting.location,
    additional: d.additional_locations,
    locationType: typeof d.location_type === 'string' ? d.location_type : null,
  })
  if (!reach.ok) return { entries: [], held: 'no_country' }

  const base = {
    postingId: posting.id,
    title: posting.title.trim(),
    description: posting.description ?? '',
    url: `${opts.jobUrl}${opts.jobUrl.includes('?') ? '&' : '?'}source=${opts.board}`,
    datePosted: postedDate(posting.created_at, opts.now),
    employmentType: d.employment_type,
    remote: reach.remote,
    salary: feedSalary(d),
    language: (typeof d.language === 'string' && d.language.slice(0, 2).toLowerCase()) || 'en',
  }
  const entries = reach.places.map((p) => ({
    ...base,
    ref: reach.places.length === 1 ? posting.id : `${posting.id}-${[p.country, slug(p.city)].filter(Boolean).join('-').toLowerCase()}`,
    city: p.city,
    state: p.region,
    country: countryNameOf(p.country),
    countryCode: p.country,
  }))
  return { entries, held: null }
}

/* ── XML ─────────────────────────────────────────────────────────────────── */

export function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** Text inside CDATA goes as it is (escaping it shows "&amp;" on the board); only the end marker is split. */
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`

const dmy = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
}

export interface FeedRender {
  board: FeedBoard
  company: string
  entries: FeedEntry[]
  now: Date
  /** Talent.com only: where it posts applications and reads questions, by post. */
  talentApply?: (postingId: string) => { postUrl: string; questionsUrl: string }
}

export function renderFeed({ board, company, entries, now, talentApply }: FeedRender): string {
  if (board === 'whatjobs') {
    const jobs = entries.map((e) => {
      const salary = e.salary ? `${[e.salary.min, e.salary.max].filter((v) => v !== null).join(' - ')} ${e.salary.currency} / ${e.salary.period}` : ''
      const type = talentJobType(e.employmentType)
      return `
  <job id="${escapeXml(e.ref)}">
    <id>${cdata(e.ref)}</id>
    <link>${cdata(e.url)}</link>
    <title>${cdata(e.title)}</title>
    <city>${cdata(e.city)}</city>
    <region>${cdata(e.state)}</region>
    <state>${cdata(e.state)}</state>
    <country>${cdata(e.country)}</country>
    <language>${cdata(e.language)}</language>
    <description>${cdata(e.description)}</description>
    <pubdate>${cdata(dmy(e.datePosted))}</pubdate>
    <company>${cdata(company)}</company>
    ${salary ? `<salary>${cdata(salary)}</salary>` : ''}
    ${type ? `<jobtype>${cdata(type)}</jobtype>` : ''}
    ${e.remote ? `<joblocationtype>${cdata('telecommute')}</joblocationtype>` : ''}
  </job>`
    }).join('\n')
    return `<?xml version="1.0" encoding="utf-8"?>
<jobs>
  ${jobs}
</jobs>`
  }

  if (board === 'juju') {
    const jobs = entries.map((e) => `
  <job id="${escapeXml(e.ref)}">
    <employer>${cdata(company)}</employer>
    <title>${cdata(e.title)}</title>
    <description>${cdata(e.description)}</description>
    <postingdate>${e.datePosted.slice(0, 10)}</postingdate>
    <joburl>${cdata(e.url)}</joburl>
    <location>
      <city>${cdata(e.city)}</city>
      <state>${cdata(e.state)}</state>
      <nation>${cdata(e.country)}</nation>
    </location>
    <type>${jujuJobType(e.employmentType)}</type>
  </job>`).join('\n')
    return `<?xml version="1.0" encoding="utf-8"?>
<jobs>
  <jobsource>${cdata('Gio ATS')}</jobsource>
  <sourceurl>${cdata('https://app.gogio.io')}</sourceurl>
  <feeddate>${now.toISOString()}</feeddate>
  ${jobs}
</jobs>`
  }

  // talent, jooble, adzuna, careerjet, jobrapido
  const jobs = entries.map((e) => {
    const type = talentJobType(e.employmentType)
    const apply = board === 'talent' && talentApply ? talentApply(e.postingId) : null
    return `
  <job>
    <referencenumber>${escapeXml(e.ref)}</referencenumber>
    <title>${cdata(e.title)}</title>
    <company>${cdata(company)}</company>
    ${e.city ? `<city>${cdata(e.city)}</city>` : ''}
    ${e.state ? `<state>${cdata(e.state)}</state>` : ''}
    <country>${cdata(e.country)}</country>
    <dateposted>${e.datePosted}</dateposted>
    <url>${cdata(e.url)}</url>
    <description>${cdata(e.description)}</description>
    ${type ? `<jobtype>${cdata(type)}</jobtype>` : ''}
    <isremote>${e.remote ? 'yes' : 'no'}</isremote>
    ${e.salary ? `
    <salary>
      <currency>${e.salary.currency}</currency>
      <period>${e.salary.period}</period>
      ${e.salary.min !== null ? `<min>${e.salary.min}</min>` : ''}
      ${e.salary.max !== null ? `<max>${e.salary.max}</max>` : ''}
    </salary>` : ''}
    ${apply ? `<talent-apply-data>${cdata(`talent-apply-posturl=${encodeURIComponent(apply.postUrl)}&talent-apply-questions=${encodeURIComponent(apply.questionsUrl)}`)}</talent-apply-data>` : ''}
  </job>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>GoGio</publisher>
  <publisherurl>https://app.gogio.io</publisherurl>
  <lastbuilddate>${now.toISOString()}</lastbuilddate>
  ${jobs}
</source>`
}
