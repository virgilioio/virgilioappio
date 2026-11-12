/**
 * Where an application came from (job exposure, Phase 1; Allan, Go! 2026-11-12).
 *
 * One list for the careers pages (which read the link's tags and the sending site),
 * public-submit-application (which turns them into `job_candidate_associations.applied_via`)
 * and the screens (labels). Pure: no Deno or browser APIs, so `src/` imports it too.
 *
 * A link says where it was posted with `?src=` (the share kit), `?source=` (the job
 * board feeds) or `?utm_source=`; without one, the site that sent the visitor decides
 * (linkedin.com, google.com, jooble.org, ...); with neither it's a direct visit.
 */

export type ChannelKind = 'direct' | 'search' | 'social' | 'message' | 'board' | 'other'

export interface Channel {
  key: string
  label: string
  kind: ChannelKind
  /** Sites that send people from this channel: `linkedin.com` matches it and its subdomains, `google.` any country domain. */
  hosts?: string[]
  /** Other spellings of the key in a link's tags. */
  aliases?: string[]
}

export const CHANNELS: Channel[] = [
  { key: 'direct', label: 'Direct or unknown', kind: 'direct' },
  { key: 'google', label: 'Google', kind: 'search', hosts: ['google.'], aliases: ['google_jobs', 'googlejobs', 'google_for_jobs'] },
  { key: 'bing', label: 'Bing', kind: 'search', hosts: ['bing.com'] },
  { key: 'chatgpt', label: 'ChatGPT', kind: 'search', hosts: ['chatgpt.com', 'chat.openai.com'], aliases: ['openai'] },
  { key: 'linkedin', label: 'LinkedIn', kind: 'social', hosts: ['linkedin.com', 'lnkd.in'], aliases: ['li', 'linked_in'] },
  { key: 'facebook', label: 'Facebook', kind: 'social', hosts: ['facebook.com', 'fb.com', 'fb.me'], aliases: ['fb', 'meta'] },
  { key: 'instagram', label: 'Instagram', kind: 'social', hosts: ['instagram.com'], aliases: ['ig'] },
  { key: 'x', label: 'X', kind: 'social', hosts: ['x.com', 'twitter.com', 't.co'], aliases: ['twitter'] },
  { key: 'whatsapp', label: 'WhatsApp', kind: 'message', hosts: ['whatsapp.com', 'wa.me'], aliases: ['wa', 'whats_app'] },
  { key: 'telegram', label: 'Telegram', kind: 'message', hosts: ['t.me', 'telegram.org', 'telegram.me'] },
  { key: 'slack', label: 'Slack', kind: 'message', hosts: ['slack.com'] },
  {
    key: 'email',
    label: 'Email',
    kind: 'message',
    hosts: ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'mail.yahoo.com'],
    aliases: ['mail', 'newsletter', 'gmail', 'outlook'],
  },
  { key: 'talent', label: 'Talent.com', kind: 'board', hosts: ['talent.com'], aliases: ['talent_com', 'talentcom'] },
  { key: 'jooble', label: 'Jooble', kind: 'board', hosts: ['jooble.org', 'jooble.com'] },
  { key: 'careerjet', label: 'Careerjet', kind: 'board', hosts: ['careerjet.'] },
  { key: 'whatjobs', label: 'WhatJobs', kind: 'board', hosts: ['whatjobs.com'] },
  { key: 'juju', label: 'Juju', kind: 'board', hosts: ['juju.com'] },
  { key: 'jobrapido', label: 'Jobrapido', kind: 'board', hosts: ['jobrapido.com'] },
  { key: 'adzuna', label: 'Adzuna', kind: 'board', hosts: ['adzuna.'] },
  { key: 'indeed', label: 'Indeed', kind: 'board', hosts: ['indeed.com', 'indeed.'] },
  { key: 'glassdoor', label: 'Glassdoor', kind: 'board', hosts: ['glassdoor.'] },
  { key: 'ziprecruiter', label: 'ZipRecruiter', kind: 'board', hosts: ['ziprecruiter.com'] },
  { key: 'occ', label: 'OCC Mundial', kind: 'board', hosts: ['occ.com.mx'], aliases: ['occ_mundial', 'occmundial'] },
  { key: 'computrabajo', label: 'Computrabajo', kind: 'board', hosts: ['computrabajo.'] },
  { key: 'bumeran', label: 'Bumeran', kind: 'board', hosts: ['bumeran.'] },
  { key: 'getonboard', label: 'Get on Board', kind: 'board', hosts: ['getonbrd.com', 'getonboard.com'], aliases: ['get_on_board', 'getonbrd'] },
  { key: 'wellfound', label: 'Wellfound', kind: 'board', hosts: ['wellfound.com', 'angel.co'], aliases: ['angellist'] },
  { key: 'weworkremotely', label: 'We Work Remotely', kind: 'board', hosts: ['weworkremotely.com'], aliases: ['wwr'] },
  { key: 'remoteok', label: 'Remote OK', kind: 'board', hosts: ['remoteok.com', 'remoteok.io'], aliases: ['remote_ok'] },
  { key: 'other', label: 'Another website', kind: 'other' },
]

const BY_KEY = new Map(CHANNELS.map((c) => [c.key, c]))
const BY_ALIAS = new Map<string, string>()
for (const c of CHANNELS) {
  BY_ALIAS.set(c.key, c.key)
  for (const a of c.aliases ?? []) BY_ALIAS.set(a, c.key)
}

/** Sites that are us: a visit from one of them says nothing about where the person came from. */
const OWN_HOSTS = ['gogio.io', 'virgilio.tech', 'lovable.app', 'lovableproject.com', 'localhost', '127.0.0.1']

/** What a careers page saw when the visitor arrived. Every field is as the link or browser gave it. */
export interface RawApplySource {
  src?: string | null
  source?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  /** The share kit's `?by=`: a teammate's share code, or `client`. */
  by?: string | null
  /** The host of the page that sent the visitor (never the full address). */
  referrer_host?: string | null
}

export interface ApplySourceDetail {
  tag?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  referrer_host?: string
  /** A share code from `?by=`, resolved to a teammate by the server. */
  share_code?: string
  by_client?: boolean
}

export interface ApplySource {
  channel: string
  detail: ApplySourceDetail
}

function clip(v: unknown, max = 80): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim().slice(0, max)
  return s || undefined
}

/** `LinkedIn Post` → `linkedin_post`: how a tag is compared with keys and aliases. */
export function tagKey(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** The channel a tag names, trying the whole tag and then its first word (`linkedin_post` → linkedin). */
export function channelForTag(tag: string): string | null {
  const k = tagKey(tag)
  if (!k) return null
  if (BY_ALIAS.has(k)) return BY_ALIAS.get(k)!
  const first = k.split('_')[0]
  if (first && BY_ALIAS.has(first)) return BY_ALIAS.get(first)!
  const squashed = k.replace(/_/g, '')
  if (BY_ALIAS.has(squashed)) return BY_ALIAS.get(squashed)!
  return null
}

export function normalHost(host: string | null | undefined): string | null {
  if (!host) return null
  const h = String(host).trim().toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '').replace(/\.$/, '')
  if (h === 'localhost') return h
  return /^[a-z0-9.-]{1,120}$/.test(h) && h.includes('.') ? h : null
}

function hostMatches(host: string, pattern: string): boolean {
  if (pattern.endsWith('.')) {
    // `google.` is google.com, google.com.mx, mail.google.co.uk, ...
    const base = pattern.slice(0, -1)
    return new RegExp(`(^|\\.)${base.replace(/[.]/g, '\\.')}\\.[a-z.]{2,12}$`).test(host)
  }
  return host === pattern || host.endsWith(`.${pattern}`)
}

export function isOwnHost(host: string | null | undefined): boolean {
  const h = normalHost(host)
  if (!h) return false
  return OWN_HOSTS.some((o) => hostMatches(h, o))
}

/** The channel a sending site belongs to, or null when it's none we know. */
export function channelForHost(host: string | null | undefined): string | null {
  const h = normalHost(host)
  if (!h) return null
  // The more specific site first: mail.google.com is Email, not Google.
  let best: { key: string; len: number } | null = null
  for (const c of CHANNELS) {
    for (const p of c.hosts ?? []) {
      if (hostMatches(h, p) && (!best || p.length > best.len)) best = { key: c.key, len: p.length }
    }
  }
  return best?.key ?? null
}

/**
 * Where an application came from. Tags first (`src`, then `source`, then `utm_source`),
 * then the sending site, else a direct visit. A tag we don't know is `other`, kept in
 * the detail so nothing is lost.
 */
export function resolveApplySource(raw: RawApplySource | null | undefined): ApplySource {
  const r = raw ?? {}
  const detail: ApplySourceDetail = {}
  const utmSource = clip(r.utm_source)
  const utmMedium = clip(r.utm_medium)
  const utmCampaign = clip(r.utm_campaign)
  if (utmSource) detail.utm_source = utmSource
  if (utmMedium) detail.utm_medium = utmMedium
  if (utmCampaign) detail.utm_campaign = utmCampaign

  const refHost = normalHost(r.referrer_host)
  const external = refHost && !isOwnHost(refHost) ? refHost : null
  if (external) detail.referrer_host = external

  const by = clip(r.by, 16)?.toLowerCase()
  if (by === 'client') detail.by_client = true
  else if (by && /^[a-z0-9]{8}$/.test(by)) detail.share_code = by

  const tag = clip(r.src) ?? clip(r.source) ?? utmSource
  if (tag) {
    const fromTag = channelForTag(tag)
    if (fromTag) {
      if (fromTag !== tagKey(tag)) detail.tag = tag
      return { channel: fromTag, detail }
    }
    detail.tag = tag
    return { channel: 'other', detail }
  }

  if (external) return { channel: channelForHost(external) ?? 'other', detail }
  return { channel: 'direct', detail }
}

export function channelOf(key: string | null | undefined): Channel | null {
  return key ? BY_KEY.get(key) ?? null : null
}

/** "LinkedIn", "Another website (example.org)", or "Not tracked" for an application from before 2026-11-12. */
export function channelLabel(key: string | null | undefined, detail?: ApplySourceDetail | null): string {
  if (!key) return 'Not tracked'
  const c = BY_KEY.get(key)
  if (!c) return 'Another website'
  if (c.key === 'other') {
    const what = detail?.referrer_host || detail?.tag
    return what ? `Another website (${what})` : c.label
  }
  return c.label
}

/** The line under an application: "LinkedIn · shared by Allan", "WhatsApp · the client's team". */
export function appliedViaText(
  key: string | null | undefined,
  detail?: (ApplySourceDetail & { shared_by_name?: string | null }) | null,
): string {
  const base = channelLabel(key, detail)
  if (detail?.by_client) return `${base} · the client's team`
  if (detail?.shared_by_name) return `${base} · shared by ${detail.shared_by_name}`
  return base
}
