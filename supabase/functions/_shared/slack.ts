// Slack for Gio ATS: the Web API, the sealed OAuth state, and how a message is
// written from an automation's template (Allan, 2026-10-27).
//
// A template is the person's text with {details} and Slack tags (<@U...>). The
// details come from slack_message_context (names only, never pay); people
// become real Slack @mentions when Slack knows their email. Everything a
// person typed is escaped for Slack, except the tags themselves.

import { isAllowedOrigin } from './cors.ts'

export const SLACK_SCOPES = [
  'chat:write',
  'chat:write.public',
  'channels:read',
  'groups:read',
  'users:read',
  'users:read.email',
  'im:write',
  'team:read',
]

// deno-lint-ignore no-explicit-any
const env = (k: string): string | undefined => (globalThis as any).Deno?.env?.get(k)

export const APP_URL = (env('APP_URL') || 'https://app.gogio.io').replace(/\/+$/, '')

export function callbackUrl(): string {
  return `${(env('SUPABASE_URL') ?? '').replace(/\/+$/, '')}/functions/v1/slack`
}

// deno-lint-ignore no-explicit-any
export type SlackResult = { ok: boolean; error?: string; [k: string]: any }

/** Calls a Slack Web API method. Never throws for a Slack error: read `ok`. */
export async function slackApi(token: string, method: string, body: Record<string, unknown> = {}): Promise<SlackResult> {
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue
    form.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  if (res.status === 429) return { ok: false, error: 'ratelimited', retry_after: Number(res.headers.get('Retry-After') ?? 30) }
  try {
    return (await res.json()) as SlackResult
  } catch {
    return { ok: false, error: `http_${res.status}` }
  }
}

/** Slack's error codes in plain words for the automation's status line. */
export function slackProblem(code: string | undefined, where?: string): string {
  const place = where ? where : 'that channel'
  switch (code) {
    case 'not_in_channel':
    case 'channel_not_found':
      return `Gio isn't in ${place}. Type /invite @Gio there.`
    case 'is_archived':
      return `${place} is archived.`
    case 'invalid_auth':
    case 'token_revoked':
    case 'account_inactive':
    case 'not_authed':
      return 'Slack disconnected Gio. Reconnect it in Settings > Integrations.'
    case 'user_not_found':
    case 'users_not_found':
      return 'That person is no longer in your Slack.'
    case 'cannot_dm_bot':
      return "Gio can't message a bot."
    case 'ratelimited':
      return 'Slack asked Gio to slow down; it will try again.'
    case 'msg_too_long':
      return 'The message is too long for Slack.'
    default:
      return `Slack said no (${code ?? 'unknown error'}).`
  }
}

export const RETRYABLE = new Set(['ratelimited', 'internal_error', 'fatal_error', 'service_unavailable', 'request_timeout'])
export const AUTH_GONE = new Set(['invalid_auth', 'token_revoked', 'account_inactive', 'not_authed'])

// ---------- Sealed OAuth state ----------

export interface SlackOAuthState {
  tenant_id: string
  user_id: string
  return_origin: string
  timestamp: number
  nonce: string
}

const STATE_MAX_AGE_MS = 15 * 60 * 1000

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function stateKey(): Promise<CryptoKey> {
  const secret = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret) throw new Error('Server misconfiguration: missing service key')
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`slack-oauth-state:${secret}`))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function sealState(state: SlackOAuthState): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await stateKey(), new TextEncoder().encode(JSON.stringify(state))),
  )
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return `s1.${b64url(out)}`
}

export async function openState(sealed: string): Promise<SlackOAuthState> {
  if (!sealed?.startsWith('s1.')) throw new Error('state_invalid')
  let state: SlackOAuthState
  try {
    const bytes = fromB64url(sealed.slice(3))
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await stateKey(), bytes.slice(12))
    state = JSON.parse(new TextDecoder().decode(pt))
  } catch {
    throw new Error('state_invalid')
  }
  if (!state.tenant_id || !state.user_id) throw new Error('state_invalid')
  if (Date.now() - state.timestamp > STATE_MAX_AGE_MS) throw new Error('state_expired')
  if (!isAllowedOrigin(state.return_origin).allowed) state.return_origin = APP_URL
  return state
}

// ---------- Writing the message ----------

export interface Person {
  id?: string
  name: string
  email?: string | null
}

export interface MessageContext {
  candidate?: { id: string; name: string } | null
  job?: { id: string; title: string; client?: string | null; department?: string | null } | null
  stage?: string | null
  from_stage?: string | null
  actor?: Person | null
  reason?: string | null
  opening?: string | null
  recruiters?: Person[]
  sourcers?: Person[]
  hiring_managers?: Person[]
  interviewer?: Person | null
  interview_start?: string | null
  interview_title?: string | null
  rating?: string | null
  /** An offer approval: whose turn it is, and "Step 2 of 3". */
  approvers?: Person[]
  approval_step?: string | null
  /** This message is an approver's turn (it goes only to them). */
  turn?: boolean
  /** People: the team member it's about, what their profile still needs
   * (card keys, never anything in them), "4 of 6 done", and where it opens. */
  member?: Person | null
  missing?: string[]
  progress?: string | null
  link?: string | null
}

/** A profile's cards in a sentence, as My profile's To do card names them. */
const MISSING_LABEL: Record<string, string> = {
  you: 'photo and title',
  personal: 'country and contact',
  birthday: 'birthday',
  tax: 'tax ID',
  bank: 'bank details',
  shipping: 'shipping address',
}

/** "birthday, tax ID and bank details". */
export function missingSentence(keys: string[] | undefined): string | null {
  const names = (keys ?? []).map((k) => MISSING_LABEL[k] ?? k.replace(/_/g, ' '))
  if (!names.length) return null
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Escapes text for Slack mrkdwn (&, <, >). */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const RATING: Record<string, string> = {
  strong_yes: 'Strong yes',
  yes: 'Yes',
  lean_yes: 'Lean yes',
  lean_no: 'Lean no',
  no: 'No',
  strong_no: 'Strong no',
  definitely_no: 'Definitely no',
}

export function ratingLabel(r: string | null | undefined): string | null {
  if (!r) return null
  return RATING[r] ?? r.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function candidateUrl(ctx: MessageContext): string | null {
  if (!ctx.candidate?.id) return null
  return ctx.job?.id
    ? `${APP_URL}/jobs/${ctx.job.id}/candidates/${ctx.candidate.id}`
    : `${APP_URL}/candidates/${ctx.candidate.id}`
}

export function jobUrl(ctx: MessageContext): string | null {
  return ctx.job?.id ? `${APP_URL}/jobs/${ctx.job.id}` : null
}

/** A person as a Slack mention when we found them in Slack, else their name. */
export type MentionOf = (p: Person) => string | null

function people(list: Person[] | undefined, mention: MentionOf): string | null {
  const names = (list ?? []).filter(Boolean).map((p) => mention(p) ?? esc(p.name))
  return names.length ? names.join(', ') : null
}

/** Values for every {detail}, already escaped / formatted for Slack. */
export function detailValues(ctx: MessageContext, mention: MentionOf): Record<string, string | null> {
  const cUrl = candidateUrl(ctx)
  const jUrl = jobUrl(ctx)
  const when = ctx.interview_start ? Math.floor(new Date(ctx.interview_start).getTime() / 1000) : null
  return {
    who: ctx.actor ? (mention(ctx.actor) ?? esc(ctx.actor.name)) : 'Gio',
    candidate: ctx.candidate ? (cUrl ? `<${cUrl}|${esc(ctx.candidate.name)}>` : esc(ctx.candidate.name)) : null,
    job: ctx.job ? (jUrl ? `<${jUrl}|${esc(ctx.job.title)}>` : esc(ctx.job.title)) : null,
    client: ctx.job?.client ? esc(ctx.job.client) : null,
    department: ctx.job?.department ? esc(ctx.job.department) : null,
    stage: ctx.stage ? esc(ctx.stage) : null,
    previous_stage: ctx.from_stage ? esc(ctx.from_stage) : null,
    recruiter: people(ctx.recruiters, mention),
    sourcer: people(ctx.sourcers, mention),
    hiring_manager: people(ctx.hiring_managers, mention),
    interviewer: ctx.interviewer ? (mention(ctx.interviewer) ?? esc(ctx.interviewer.name)) : null,
    interview_time: when ? `<!date^${when}^{date_short_pretty} at {time}|${new Date(when * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC>` : null,
    rating: ratingLabel(ctx.rating),
    reason: ctx.reason ? esc(ctx.reason) : null,
    opening: ctx.opening ? esc(ctx.opening) : null,
    approver: people(ctx.approvers, mention),
    approval_step: ctx.approval_step ? esc(ctx.approval_step) : null,
    member: ctx.member ? (mention(ctx.member) ?? esc(ctx.member.name)) : null,
    missing: ctx.missing ? esc(missingSentence(ctx.missing) ?? '') || null : null,
    progress: ctx.progress ? esc(ctx.progress) : null,
  }
}

// Typographic marks without non-ASCII source (Edge Function files stay ASCII).
const DOT = String.fromCharCode(183)
const DASH = String.fromCharCode(8212)

const TAG = /<(@[UW][A-Z0-9]+|#[CG][A-Z0-9]+(?:\|[^>]*)?|!here|!channel)>/g
const DETAIL = /\{\s*([a-z_]+)\s*\}/g

/**
 * The person's template as Slack mrkdwn: their text escaped, Slack tags kept,
 * {details} filled (a dash when there's nothing to say).
 */
export function renderTemplate(template: string, values: Record<string, string | null>): string {
  const parts: string[] = []
  let last = 0
  for (const m of template.matchAll(TAG)) {
    parts.push(fillDetails(esc(template.slice(last, m.index)), values))
    parts.push(m[0])
    last = (m.index ?? 0) + m[0].length
  }
  parts.push(fillDetails(esc(template.slice(last)), values))
  return parts.join('')
}

function fillDetails(text: string, values: Record<string, string | null>): string {
  return text.replace(DETAIL, (whole, key: string) => {
    if (!(key in values)) return whole
    return values[key] ?? DASH
  })
}

/** Plain text for notifications and screen readers (no links or tags). */
export function plainText(mrkdwn: string): string {
  return mrkdwn
    .replace(/<!date\^\d+\^[^|]*\|([^>]*)>/g, '$1')
    .replace(/<[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<@[A-Z0-9]+>/g, '@someone')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .slice(0, 3000)
}

/** The message: the text, then a quiet line with where it came from. */
export function messageBlocks(text: string, ctx: MessageContext, test = false): unknown[] {
  const link = candidateUrl(ctx) ?? jobUrl(ctx) ?? (ctx.link ? `${APP_URL}${ctx.link}` : APP_URL)
  const where = [ctx.job?.title, ctx.job?.client].filter(Boolean).map((s) => esc(String(s))).join(` ${DOT} `)
  return [
    { type: 'section', text: { type: 'mrkdwn', text: text.slice(0, 3000) } },
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `${test ? `Test from Gio ${DOT} example details ${DOT} ` : `Gio ATS ${DOT} `}${where ? `${where} ${DOT} ` : ''}<${link}|Open in Gio>`,
      }],
    },
  ]
}

/** Looks people up in Slack by email, once per address per run. */
export function makeResolver(token: string) {
  const cache = new Map<string, string | null>()
  return {
    async load(list: Array<Person | null | undefined>) {
      const emails = [...new Set(list.map((p) => p?.email?.toLowerCase()).filter((e): e is string => !!e && !cache.has(e)))]
      await Promise.all(emails.map(async (email) => {
        const r = await slackApi(token, 'users.lookupByEmail', { email })
        cache.set(email, r.ok && r.user?.id && !r.user.deleted ? String(r.user.id) : null)
      }))
    },
    idFor(p: Person | null | undefined): string | null {
      const e = p?.email?.toLowerCase()
      return e ? cache.get(e) ?? null : null
    },
    mention(p: Person): string | null {
      const id = this.idFor(p)
      return id ? `<@${id}>` : null
    },
  }
}

export type Destination =
  | { type: 'channel'; id: string; name?: string }
  | { type: 'user'; id: string; name?: string }
  | { type: 'role'; role: 'recruiter' | 'sourcer' | 'hiring_manager' | 'interviewer' | 'approver' | 'member' }

export const ROLE_LABEL: Record<string, string> = {
  recruiter: 'the Recruiter',
  sourcer: 'the Sourcer',
  hiring_manager: 'the Hiring manager',
  interviewer: 'the interviewer',
  approver: 'the offer approver',
  member: 'the team member',
}

export function peopleForRole(ctx: MessageContext, role: string): Person[] {
  switch (role) {
    case 'recruiter': return ctx.recruiters ?? []
    case 'sourcer': return ctx.sourcers ?? []
    case 'hiring_manager': return ctx.hiring_managers ?? []
    case 'interviewer': return ctx.interviewer ? [ctx.interviewer] : []
    case 'approver': return ctx.approvers ?? []
    case 'member': return ctx.member ? [ctx.member] : []
    default: return []
  }
}

export interface PostResult {
  to: string
  ok: boolean
  error?: string
  problem?: string
  ts?: string
}

/** Posts to a channel, or to a person by DM. */
export async function postTo(
  token: string,
  target: { channel?: string; user?: string; label: string },
  text: string,
  blocks: unknown[],
): Promise<PostResult> {
  let channel = target.channel
  if (!channel && target.user) {
    const open = await slackApi(token, 'conversations.open', { users: target.user })
    if (!open.ok) return { to: target.label, ok: false, error: open.error, problem: slackProblem(open.error, target.label) }
    channel = open.channel?.id
  }
  if (!channel) return { to: target.label, ok: false, error: 'channel_not_found', problem: slackProblem('channel_not_found', target.label) }
  const r = await slackApi(token, 'chat.postMessage', {
    channel,
    text: plainText(text),
    blocks,
    unfurl_links: false,
    unfurl_media: false,
  })
  return r.ok
    ? { to: target.label, ok: true, ts: r.ts }
    : { to: target.label, ok: false, error: r.error, problem: slackProblem(r.error, target.label) }
}

const isApprover = (d: Destination) => d.type === 'role' && d.role === 'approver'

/**
 * Who hears this message: an approver's turn goes only to the offer approver;
 * the request's own message goes everywhere else (the approver hears on their
 * turn, never twice). A test goes everywhere.
 */
export function destinationsFor(destinations: Destination[], ctx: MessageContext, test = false): Destination[] {
  if (test) return destinations
  return destinations.filter((d) => isApprover(d) === Boolean(ctx.turn))
}

/**
 * Sends one automation's message to all its destinations. Role destinations
 * DM each person the role names (found in Slack by email); `testTo` sends
 * role destinations to that Slack user instead (Send test).
 */
export async function deliver(
  token: string,
  template: string,
  destinations: Destination[],
  ctx: MessageContext,
  opts: { test?: boolean; testTo?: string | null } = {},
): Promise<PostResult[]> {
  const resolver = makeResolver(token)
  const everyone: Person[] = [
    ctx.actor, ctx.interviewer,
    ...(ctx.recruiters ?? []), ...(ctx.sourcers ?? []), ...(ctx.hiring_managers ?? []),
    ...(ctx.approvers ?? []), ctx.member,
  ].filter(Boolean) as Person[]
  await resolver.load(everyone)
  const text = renderTemplate(template, detailValues(ctx, (p) => resolver.mention(p)))
  const blocks = messageBlocks(text, ctx, opts.test)

  const targets: Array<{ channel?: string; user?: string; label: string }> = []
  const missing: PostResult[] = []
  const seenUsers = new Set<string>()
  for (const d of destinationsFor(destinations, ctx, opts.test)) {
    if (d.type === 'channel') targets.push({ channel: d.id, label: d.name ? `#${d.name}` : 'that channel' })
    else if (d.type === 'user') {
      if (!seenUsers.has(d.id)) targets.push({ user: d.id, label: d.name ?? 'that person' })
      seenUsers.add(d.id)
    } else if (d.type === 'role') {
      if (opts.test) {
        if (opts.testTo && !seenUsers.has(opts.testTo)) targets.push({ user: opts.testTo, label: 'you' })
        if (opts.testTo) seenUsers.add(opts.testTo)
        continue
      }
      const list = peopleForRole(ctx, d.role)
      if (list.length === 0) {
        missing.push({
          to: ROLE_LABEL[d.role],
          ok: true,
          problem: d.role === 'approver'
            ? 'Nobody has a turn to approve.'
            : d.role === 'member'
              ? 'That team member is no longer here.'
              : `This job has no ${ROLE_LABEL[d.role].replace('the ', '')}.`,
        })
      }
      for (const p of list) {
        const id = resolver.idFor(p)
        if (!id) {
          missing.push({ to: p.name, ok: false, error: 'no_slack_account', problem: `${p.name} isn't in your Slack under ${p.email ?? 'their email'}.` })
          continue
        }
        if (!seenUsers.has(id)) targets.push({ user: id, label: p.name })
        seenUsers.add(id)
      }
    }
  }
  const posted = await Promise.all(targets.map((t) => postTo(token, t, text, blocks)))
  return [...posted, ...missing]
}
