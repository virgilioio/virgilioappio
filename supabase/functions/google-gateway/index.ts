/**
 * Google gateway for Gio Sales (booking links, 2026-10-15).
 *
 * Each person has one Google Workspace connection, kept here in Gio ATS
 * (user_mail_identities + calendar_identities, refresh tokens encrypted in
 * Vault). Gio Sales never holds Google tokens: its server asks this function
 * for narrow actions on a person's behalf, naming the person by email.
 *
 * Auth: x-gio-timestamp (unix seconds) and x-gio-signature, the hex
 * HMAC-SHA256 of `${timestamp}.${rawBody}` with GIO_LINK_SECRET (the secret
 * Gio Sales and Gio ATS already share). Requests older than 5 minutes are
 * refused. Only Gio Sales' server knows the secret.
 *
 * The person must be an active member of the Gio ATS workspace
 * (GIO_ATS_TENANT_ID). Body: { action, email, ... }
 *   status         -> { connected, google_email, mail, calendar, error }
 *   connect_start  { return_origin } -> { auth_url }  (same Google flow as the
 *                  ATS; Google returns to the ATS callback page, which posts
 *                  'mail-oauth-success' back to return_origin)
 *   disconnect     -> removes the connection, exactly as the ATS button does
 *   freebusy       { time_min, time_max } -> { busy: [{start,end}] } (primary)
 *   create_event   { summary, description, start, end, time_zone, attendees,
 *                  meet, conference_data, event_id } -> { id, meet_link, conference_data }
 *   delete_event   { event_id } -> { ok }   (404 counts as removed)
 *   send_email     { to, cc, bcc, subject, html, text, attachments, thread_id,
 *                  in_reply_to, references } -> { id, thread_id, message_id, from }
 *                  sent from the person's own Gmail; thread_id + in_reply_to
 *                  keep a reply in its Gmail thread. Up to 10 attachments
 *                  ({ filename, content (base64), content_type }), 10MB each and
 *                  25MB in total (2026-10-30, was 3 and about 1.5MB); a large
 *                  message goes through Gmail's upload endpoint.
 *   list_messages  { addresses, after, page_token } -> { messages: [{ id, thread_id }],
 *                  next_page_token }  mail to, from or cc any of up to 40
 *                  addresses since `after` (unix seconds); chats and drafts left out.
 *   get_message    { id } -> { gmail_id, gmail_thread_id, message_id, in_reply_to,
 *                  references, from, from_name, to, cc, subject, body, html,
 *                  sent_at, attachments, files, labels }
 *                  one message, parsed: the plain-text body, the HTML body
 *                  (2026-10-30), attachment names, and files: [{ filename,
 *                  mime_type, size, attachment_id }] to fetch with get_attachment.
 *   get_messages   { ids } -> { messages: [...] }  up to 25 at once, same shape
 *                  (one call instead of many, so Supabase's per-trace limit holds).
 *   get_attachment { message_id, attachment_id } -> { data (base64), size }
 *                  one file of a message, up to 25MB (2026-10-30).
 *   get_thread     { thread_id } -> { messages: [{ id }] }  every message id in a
 *                  Gmail thread, oldest first, so later replies are found (2026-10-30).
 *
 * Keep this file ASCII only: the deploy tool rewrites escape sequences.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { getFreshCalendarAccessToken } from '../_shared/googleCalendarAuth.ts'
import { allowedRedirectBases, pickRedirectBase, sealState } from '../_shared/mailOAuthState.ts'

const MAX_SKEW_SECONDS = 300
const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary'
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MESSAGE_ID = /^<[^<>\s]{3,490}>$/
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
// Google event ids: base32hex (a-v, 0-9), 5 to 1024 characters.
const EVENT_ID = /^[a-v0-9]{5,1024}$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

class Refusal extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message)
  }
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const utf8b64 = (s: string) => b64url(new TextEncoder().encode(s)).replace(/-/g, '+').replace(/_/g, '/')
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')
/** RFC 2047 encoded-word, so names and subjects outside ASCII arrive intact. */
const isPlain = (s: string) => [...s].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126)
const encodeWord = (s: string) => (isPlain(s) ? s : `=?UTF-8?B?${utf8b64(s)}?=`)

/** Origins Gio Sales may receive the Google result on. */
function salesOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value)
    const ok =
      (u.protocol === 'https:' &&
        (u.hostname === 'sales.gogio.io' || u.hostname.endsWith('.lovable.app') || u.hostname.endsWith('.lovableproject.com'))) ||
      u.hostname === 'localhost'
    return ok ? u.origin : null
  } catch {
    return null
  }
}

/** The active ATS member with this email, or a refusal. */
async function memberByEmail(db: SupabaseClient, email: string) {
  const tenant = Deno.env.get('GIO_ATS_TENANT_ID')
  if (!tenant) throw new Refusal('not_configured', 'GIO_ATS_TENANT_ID is not configured.', 503)
  const { data: profiles } = await db.from('profiles').select('user_id, email, first_name, last_name').ilike('email', email)
  const ids = (profiles ?? []).map((p: { user_id: string }) => p.user_id)
  if (!ids.length) throw new Refusal('no_member', 'This person has no Gio ATS account.', 404)
  const { data: member } = await db
    .from('members')
    .select('user_id, tenant_id, user_status')
    .eq('tenant_id', tenant)
    .in('user_id', ids)
    .eq('user_status', 'active')
    .limit(1)
    .maybeSingle()
  if (!member) throw new Refusal('no_member', 'This person is not active in Gio ATS.', 404)
  const profile = (profiles ?? []).find((p: { user_id: string }) => p.user_id === member.user_id)
  return { userId: member.user_id as string, profile }
}

/** A working Gmail access token for the person, refreshing it when needed. */
async function freshMailToken(db: SupabaseClient, userId: string) {
  const { data: identity } = await db
    .from('user_mail_identities')
    .select('id, email_address, display_name, access_token, token_expires_at, refresh_token_encrypted')
    .eq('user_id', userId)
    .eq('provider', 'gmail')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!identity) throw new Refusal('not_connected', 'Google Workspace is not connected.', 409)
  const exp = identity.token_expires_at ? new Date(identity.token_expires_at).getTime() : 0
  if (identity.access_token && exp > Date.now() + 60_000) return { token: identity.access_token as string, identity }

  const { data: refresh, error } = await db.rpc('decrypt_refresh_token', { encrypted_token: identity.refresh_token_encrypted })
  if (error || !refresh) throw new Refusal('token_unreadable', 'The stored Google connection could not be read. Reconnect Google Workspace.', 409)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: String(refresh),
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text()
    const message = body.includes('invalid_grant')
      ? 'Google access was revoked or expired. Please reconnect Google Workspace.'
      : `Token refresh failed: ${res.status}`
    await db.from('user_mail_identities').update({ sync_status: 'expired', sync_error: message }).eq('id', identity.id)
    throw new Refusal('token_expired', message, 409)
  }
  const t = await res.json()
  await db
    .from('user_mail_identities')
    .update({
      access_token: t.access_token,
      token_expires_at: new Date(Date.now() + Number(t.expires_in ?? 3600) * 1000).toISOString(),
      sync_status: 'active',
      sync_error: null,
    })
    .eq('id', identity.id)
  return { token: t.access_token as string, identity }
}

async function calendarToken(db: SupabaseClient, userId: string) {
  const r = await getFreshCalendarAccessToken(db as never, userId)
  if (!r.accessToken) {
    throw new Refusal(r.errorCode ?? 'not_connected', r.errorMessage ?? 'Google Calendar is not connected.', 409)
  }
  return r.accessToken
}

async function googleFailure(res: Response, what: string): Promise<never> {
  const text = await res.text()
  let detail = ''
  try {
    detail = JSON.parse(text)?.error?.message ?? ''
  } catch { /* not JSON */ }
  console.error(`[google-gateway] ${what} failed`, res.status, text.slice(0, 500))
  throw new Refusal('google_error', `Google refused to ${what} (${res.status}${detail ? `: ${detail}` : ''}).`, 502)
}

type Attachment = { filename: string; content: string; content_type: string }

type MimeExtra = { cc?: string[]; bcc?: string[]; inReplyTo?: string | null; references?: string | null }

function buildMime(from: string, to: string[], subject: string, html: string, text: string | null, attachments: Attachment[], extra: MimeExtra = {}) {
  const boundary = `gio_${crypto.randomUUID().replace(/-/g, '')}`
  const alt = `alt_${boundary}`
  const lines = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
    ...(extra.cc?.length ? [`Cc: ${extra.cc.join(', ')}`] : []),
    ...(extra.bcc?.length ? [`Bcc: ${extra.bcc.join(', ')}`] : []),
    ...(extra.inReplyTo ? [`In-Reply-To: ${extra.inReplyTo}`] : []),
    ...(extra.references ? [`References: ${extra.references}`] : []),
    `Subject: ${encodeWord(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
  ]
  if (text) {
    lines.push(`--${alt}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(utf8b64(text)), '')
  }
  lines.push(`--${alt}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(utf8b64(html)), '')
  lines.push(`--${alt}--`)
  for (const a of attachments) {
    const isIcs = a.content_type.startsWith('text/calendar')
    lines.push(
      `--${boundary}`,
      `Content-Type: ${isIcs ? 'text/calendar; charset=UTF-8; method=REQUEST' : a.content_type}; name="${a.filename}"`,
      `Content-Disposition: attachment; filename="${a.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(a.content.replace(/\s+/g, '')),
      '',
    )
  }
  lines.push(`--${boundary}--`, '')
  return lines.join('\r\n')
}

// ---------------------------------------------------------------------------
// Reading Gmail messages

type GmailHeader = { name: string; value: string }
type GmailPart = {
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { data?: string; size?: number; attachmentId?: string }
  parts?: GmailPart[]
}

function header(headers: GmailHeader[] | undefined, name: string): string | null {
  const h = (headers ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h ? h.value : null
}

function fromB64url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** "Name <a@b.com>, c@d.com" -> [{ name, email }] */
function addresses(value: string | null): { name: string | null; email: string }[] {
  if (!value) return []
  const out: { name: string | null; email: string }[] = []
  for (const part of value.match(/("[^"]*"|[^,])+/g) ?? []) {
    const m = part.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
    const email = (m ? m[2] : part).trim().toLowerCase()
    if (EMAIL.test(email)) out.push({ name: m && m[1].trim() ? m[1].trim() : null, email })
  }
  return out
}

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type FileMeta = { filename: string; mime_type: string | null; size: number | null; attachment_id: string | null }

function walk(part: GmailPart, acc: { text: string | null; html: string | null; files: string[]; meta: FileMeta[] }) {
  if (part.filename) {
    acc.files.push(part.filename.slice(0, 200))
    acc.meta.push({
      filename: part.filename.slice(0, 200),
      mime_type: part.mimeType ?? null,
      size: typeof part.body?.size === 'number' ? part.body.size : null,
      attachment_id: part.body?.attachmentId ?? null,
    })
  }
  else if (part.mimeType === 'text/plain' && part.body?.data && acc.text === null) acc.text = fromB64url(part.body.data)
  else if (part.mimeType === 'text/html' && part.body?.data && acc.html === null) acc.html = fromB64url(part.body.data)
  for (const child of part.parts ?? []) walk(child, acc)
}

function parseMessage(m: { id: string; threadId: string; internalDate?: string; labelIds?: string[]; payload?: GmailPart }) {
  const h = m.payload?.headers
  const acc = { text: null as string | null, html: null as string | null, files: [] as string[], meta: [] as FileMeta[] }
  if (m.payload) walk(m.payload, acc)
  const from = addresses(header(h, 'From'))[0] ?? null
  return {
    gmail_id: m.id,
    gmail_thread_id: m.threadId,
    message_id: header(h, 'Message-ID'),
    in_reply_to: header(h, 'In-Reply-To'),
    references: header(h, 'References'),
    from: from?.email ?? null,
    from_name: from?.name ?? null,
    to: addresses(header(h, 'To')).map((a) => a.email),
    cc: addresses(header(h, 'Cc')).map((a) => a.email),
    subject: header(h, 'Subject'),
    body: (acc.text ?? (acc.html ? htmlToText(acc.html) : '')).slice(0, 60000),
    html: acc.html ? acc.html.slice(0, 400000) : null,
    sent_at: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
    attachments: acc.files.slice(0, 20),
    files: acc.meta.slice(0, 20),
    labels: m.labelIds ?? [],
  }
}

async function handle(db: SupabaseClient, p: Record<string, unknown>) {
  const action = String(p.action ?? '')
  const email = String(p.email ?? '').trim().toLowerCase()
  if (!EMAIL.test(email)) throw new Refusal('bad_request', 'email is required.')
  const { userId, profile } = await memberByEmail(db, email)

  if (action === 'status') {
    const [{ data: mail }, { data: cal }] = await Promise.all([
      db.from('user_mail_identities').select('email_address, is_active, sync_status, sync_error').eq('user_id', userId).eq('provider', 'gmail').order('is_default', { ascending: false }).limit(1).maybeSingle(),
      db.from('calendar_identities').select('email_address, is_active, sync_status, sync_error_message').eq('user_id', userId).eq('provider', 'google').limit(1).maybeSingle(),
    ])
    const mailOk = !!mail?.is_active && mail.sync_status !== 'expired'
    const calOk = !!cal?.is_active && cal.sync_status !== 'expired'
    return {
      connected: !!(mail || cal),
      healthy: mailOk && calOk,
      google_email: mail?.email_address ?? cal?.email_address ?? null,
      mail: mail ? (mailOk ? 'ok' : 'expired') : 'missing',
      calendar: cal ? (calOk ? 'ok' : 'expired') : 'missing',
      error: (!mailOk && mail?.sync_error) || (!calOk && cal?.sync_error_message) || null,
    }
  }

  if (action === 'connect_start') {
    const returnOrigin = salesOrigin(p.return_origin)
    if (!returnOrigin) throw new Refusal('bad_request', 'return_origin is not a Gio Sales address.')
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    if (!clientId || !allowedRedirectBases().length) throw new Refusal('not_configured', 'Google sign-in is not configured in Gio ATS.', 503)
    const verifierBytes = crypto.getRandomValues(new Uint8Array(32))
    const verifier = b64url(verifierBytes)
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
    // Google only returns to addresses registered for the ATS, so the callback
    // stays on the ATS; it posts the result back to Gio Sales.
    const redirectBase = pickRedirectBase(null)
    const state = await sealState({
      user_id: userId,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
      code_verifier: verifier,
      redirect_base: redirectBase,
      return_origin: returnOrigin,
    })
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${redirectBase}/mail/oauth/callback`,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      include_granted_scopes: 'true',
      login_hint: email,
    }).toString()
    return { auth_url: authUrl, callback_origin: redirectBase }
  }

  if (action === 'disconnect') {
    // Same as the ATS "Disconnect" button (disconnect-google-workspace).
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      db.from('user_mail_identities').delete().eq('user_id', userId).eq('provider', 'gmail'),
      db.from('calendar_identities').delete().eq('user_id', userId).eq('provider', 'google'),
    ])
    if (e1 || e2) throw new Refusal('store_failed', 'Could not remove the Google connection.', 500)
    return { ok: true }
  }

  if (action === 'freebusy') {
    const timeMin = new Date(String(p.time_min ?? ''))
    const timeMax = new Date(String(p.time_max ?? ''))
    if (isNaN(timeMin.getTime()) || isNaN(timeMax.getTime()) || timeMax <= timeMin) throw new Refusal('bad_request', 'time_min and time_max are required.')
    if (timeMax.getTime() - timeMin.getTime() > 100 * 86_400_000) throw new Refusal('bad_request', 'The range is limited to 100 days.')
    const token = await calendarToken(db, userId)
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: 'primary' }] }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) await googleFailure(res, 'read the calendar')
    const data = await res.json()
    return { busy: data.calendars?.primary?.busy ?? [] }
  }

  if (action === 'create_event') {
    const start = new Date(String(p.start ?? ''))
    const end = new Date(String(p.end ?? ''))
    const summary = String(p.summary ?? '').slice(0, 300)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start || !summary) throw new Refusal('bad_request', 'summary, start and end are required.')
    const tz = typeof p.time_zone === 'string' && p.time_zone ? p.time_zone : 'UTC'
    const attendees = (Array.isArray(p.attendees) ? p.attendees : [])
      .slice(0, 20)
      .map((a) => a as Record<string, unknown>)
      .filter((a) => EMAIL.test(String(a.email ?? '')))
      .map((a) => ({ email: String(a.email), ...(a.accepted ? { responseStatus: 'accepted' } : {}) }))
    const eventId = typeof p.event_id === 'string' && EVENT_ID.test(p.event_id) ? p.event_id : undefined
    const body: Record<string, unknown> = {
      ...(eventId ? { id: eventId } : {}),
      summary,
      description: String(p.description ?? '').slice(0, 8000),
      start: { dateTime: start.toISOString(), timeZone: tz },
      end: { dateTime: end.toISOString(), timeZone: tz },
      attendees,
      ...(typeof p.location === 'string' && p.location ? { location: p.location.slice(0, 500) } : {}),
      reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 30 }] },
    }
    if (p.conference_data && typeof p.conference_data === 'object') body.conferenceData = p.conference_data
    else if (p.meet) body.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
    const token = await calendarToken(db, userId)
    let res = await fetch(`${CAL}/events?conferenceDataVersion=1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
    // A repeated request with the same event id: return the event already made.
    if (res.status === 409 && eventId) {
      res = await fetch(`${CAL}/events/${eventId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) })
    }
    if (!res.ok) await googleFailure(res, 'create the calendar event')
    const ev = await res.json()
    return {
      id: ev.id,
      meet_link: ev.hangoutLink ?? ev.conferenceData?.entryPoints?.find((e: { entryPointType?: string }) => e.entryPointType === 'video')?.uri ?? null,
      conference_data: ev.conferenceData ?? null,
      html_link: ev.htmlLink ?? null,
    }
  }

  if (action === 'delete_event') {
    const eventId = String(p.event_id ?? '')
    if (!/^[A-Za-z0-9_-]{5,1024}$/.test(eventId)) throw new Refusal('bad_request', 'event_id is required.')
    const token = await calendarToken(db, userId)
    const res = await fetch(`${CAL}/events/${eventId}?sendUpdates=${p.notify ? 'all' : 'none'}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok && res.status !== 404 && res.status !== 410) await googleFailure(res, 'remove the calendar event')
    return { ok: true }
  }

  if (action === 'send_email') {
    const list = (v: unknown) => (Array.isArray(v) ? v : []).map(String).map((e) => e.trim()).filter((e) => EMAIL.test(e)).slice(0, 20)
    const to = list(p.to)
    const cc = list(p.cc)
    const bcc = list(p.bcc)
    const msgId = (v: unknown) => (typeof v === 'string' && MESSAGE_ID.test(v.trim()) ? v.trim() : null)
    const inReplyTo = msgId(p.in_reply_to)
    const references = typeof p.references === 'string'
      ? p.references.split(/\s+/).filter((r) => MESSAGE_ID.test(r)).slice(-20).join(' ') || null
      : null
    const threadId = typeof p.thread_id === 'string' && /^[A-Za-z0-9]{6,64}$/.test(p.thread_id) ? p.thread_id : null
    const subject = String(p.subject ?? '').replace(/[\r\n]+/g, ' ').slice(0, 300)
    const html = String(p.html ?? '')
    if (!to.length || !subject || !html) throw new Refusal('bad_request', 'to, subject and html are required.')
    const attachments = (Array.isArray(p.attachments) ? p.attachments : [])
      .slice(0, 10)
      .map((a) => a as Record<string, unknown>)
      .filter((a) => typeof a.content === 'string' && typeof a.filename === 'string')
      .map((a) => ({
        filename: String(a.filename).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80),
        content: String(a.content),
        content_type: /^[a-z]+\/[a-z0-9.+-]+$/i.test(String(a.content_type ?? '')) ? String(a.content_type) : 'application/octet-stream',
      }))
    // Base64 is 4/3 of the file: 10MB a file, 25MB in total.
    if (attachments.some((a) => a.content.length > 14_000_000)) throw new Refusal('too_large', 'Each attachment can be up to 10MB.')
    if (attachments.reduce((n, a) => n + a.content.length, 0) > 35_000_000) throw new Refusal('too_large', 'Attachments can be up to 25MB in total.')
    const { token, identity } = await freshMailToken(db, userId)
    const name = identity.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    const from = name ? `${encodeWord(String(name).replace(/["\r\n]/g, ''))} <${identity.email_address}>` : identity.email_address
    const mime = buildMime(from, to, subject, html, typeof p.text === 'string' ? p.text : null, attachments, {
      cc,
      bcc,
      inReplyTo,
      references: references ?? inReplyTo,
    })
    // Gmail's plain endpoint takes about 5MB; anything larger goes through its upload endpoint.
    const res = mime.length > 4_500_000
      ? await (() => {
          const cut = `gio_up_${crypto.randomUUID().replace(/-/g, '')}`
          const body = [
            `--${cut}`,
            'Content-Type: application/json; charset=UTF-8',
            '',
            JSON.stringify(threadId ? { threadId } : {}),
            `--${cut}`,
            'Content-Type: message/rfc822',
            '',
            mime,
            `--${cut}--`,
            '',
          ].join('\r\n')
          return fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${cut}` },
            body,
            signal: AbortSignal.timeout(60_000),
          })
        })()
      : await fetch(`${GMAIL}/messages/send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: b64url(new TextEncoder().encode(mime)), ...(threadId ? { threadId } : {}) }),
          signal: AbortSignal.timeout(20_000),
        })
    if (!res.ok) await googleFailure(res, 'send the email')
    const sent = await res.json()
    // The Message-ID Gmail gave it, so replies and the sync can find it.
    let messageId: string | null = null
    if (sent.id) {
      const meta = await fetch(`${GMAIL}/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      })
      if (meta.ok) messageId = header((await meta.json()).payload?.headers, 'Message-ID')
    }
    return { id: sent.id ?? null, thread_id: sent.threadId ?? null, message_id: messageId, from: identity.email_address }
  }

  if (action === 'list_messages') {
    const addresses = (Array.isArray(p.addresses) ? p.addresses : [])
      .map((a) => String(a).trim().toLowerCase())
      .filter((a) => EMAIL.test(a) && !/["{}()\s]/.test(a))
      .slice(0, 40)
    if (!addresses.length) return { messages: [], next_page_token: null }
    const after = Number(p.after)
    if (!Number.isFinite(after) || after < 0) throw new Refusal('bad_request', 'after must be unix seconds.')
    const who = addresses.map((a) => `from:${a} OR to:${a} OR cc:${a}`).join(' OR ')
    const q = `(${who}) after:${Math.floor(after)} -in:chats -in:drafts`
    const { token } = await freshMailToken(db, userId)
    const url = new URL(`${GMAIL}/messages`)
    url.searchParams.set('q', q)
    url.searchParams.set('maxResults', '100')
    url.searchParams.set('includeSpamTrash', 'false')
    if (typeof p.page_token === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(p.page_token)) url.searchParams.set('pageToken', p.page_token)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) await googleFailure(res, 'list messages')
    const body = await res.json()
    return {
      messages: (body.messages ?? []).map((m: { id: string; threadId: string }) => ({ id: m.id, thread_id: m.threadId })),
      next_page_token: body.nextPageToken ?? null,
    }
  }

  if (action === 'get_message') {
    const id = String(p.id ?? '')
    if (!/^[A-Za-z0-9]{6,64}$/.test(id)) throw new Refusal('bad_request', 'id is required.')
    const { token } = await freshMailToken(db, userId)
    const res = await fetch(`${GMAIL}/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (res.status === 404) return { missing: true }
    if (!res.ok) await googleFailure(res, 'read the message')
    return parseMessage(await res.json())
  }

  if (action === 'get_messages') {
    const ids = (Array.isArray(p.ids) ? p.ids : []).map(String).filter((x) => /^[A-Za-z0-9]{6,64}$/.test(x)).slice(0, 25)
    if (!ids.length) return { messages: [] }
    const { token } = await freshMailToken(db, userId)
    const messages = []
    for (const id of ids) {
      const res = await fetch(`${GMAIL}/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 404) {
        messages.push({ gmail_id: id, missing: true })
        continue
      }
      if (!res.ok) await googleFailure(res, 'read the message')
      messages.push(parseMessage(await res.json()))
    }
    return { messages }
  }

  if (action === 'get_attachment') {
    const id = String(p.message_id ?? '')
    const att = String(p.attachment_id ?? '')
    if (!/^[A-Za-z0-9]{6,64}$/.test(id) || !/^[A-Za-z0-9_-]{6,1000}$/.test(att)) {
      throw new Refusal('bad_request', 'message_id and attachment_id are required.')
    }
    const { token } = await freshMailToken(db, userId)
    const res = await fetch(`${GMAIL}/messages/${id}/attachments/${att}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(45_000),
    })
    if (res.status === 404) return { missing: true }
    if (!res.ok) await googleFailure(res, 'read the attachment')
    const body = await res.json()
    if (typeof body.size === 'number' && body.size > 26_214_400) throw new Refusal('too_large', 'That attachment is over 25MB.')
    const data = String(body.data ?? '').replace(/-/g, '+').replace(/_/g, '/')
    return { data, size: typeof body.size === 'number' ? body.size : null }
  }

  if (action === 'get_thread') {
    const id = String(p.thread_id ?? '')
    if (!/^[A-Za-z0-9]{6,64}$/.test(id)) throw new Refusal('bad_request', 'thread_id is required.')
    const { token } = await freshMailToken(db, userId)
    const res = await fetch(`${GMAIL}/threads/${id}?format=minimal`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (res.status === 404) return { messages: [] }
    if (!res.ok) await googleFailure(res, 'read the thread')
    const body = await res.json()
    return { messages: (body.messages ?? []).slice(0, 100).map((m: { id: string }) => ({ id: m.id })) }
  }

  throw new Refusal('bad_request', 'Unknown action.')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const secret = Deno.env.get('GIO_LINK_SECRET')
  if (!secret) return json({ error: 'GIO_LINK_SECRET is not configured.' }, 503)

  const raw = await req.text()
  const ts = req.headers.get('x-gio-timestamp') || ''
  const got = (req.headers.get('x-gio-signature') || '').trim().toLowerCase().replace(/^sha256=/, '')
  if (!/^\d{9,11}$/.test(ts) || Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > MAX_SKEW_SECONDS) {
    return json({ error: 'Request expired.', code: 'expired' }, 401)
  }
  if (!got || !safeEqual(got, await hmac(secret, `${ts}.${raw}`))) return json({ error: 'Invalid signature.', code: 'signature' }, 401)

  let p: Record<string, unknown>
  try {
    p = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON.' }, 400)
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    return json(await handle(db, p))
  } catch (e) {
    if (e instanceof Refusal) return json({ error: e.message, code: e.code }, e.status)
    console.error('[google-gateway]', e)
    return json({ error: 'Something went wrong in the Google gateway.', code: 'internal' }, 500)
  }
})
