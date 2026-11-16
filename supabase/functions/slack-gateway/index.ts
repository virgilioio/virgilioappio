// Slack gateway for Gio Sales (Gio Sales Slack automations, phase 1, 2026-11-16).
//
// Gio Sales keeps its own Slack automations and queue, and sends through Gio
// ATS's one Slack connection, so the bot token never leaves Gio ATS. Gio Sales'
// server (slack-link, slack-deliver) calls this function; nothing else can.
//
// Auth: x-gio-timestamp (unix seconds) and x-gio-signature, the hex
// HMAC-SHA256 of `${timestamp}.${rawBody}` with GIO_LINK_SECRET, as for
// google-gateway and sign-gateway. Requests older than 5 minutes are refused.
//
// Body: { action, ... }
//   status                      -> { connected, status, team_name, team_domain, team_icon }
//   directory                   -> { channels: [...], users: [...] } for the builder
//   send { messages: [{ key, to, text, blocks }] }
//        to = { type: 'channel' | 'user', id, label } | { type: 'email', email, label }
//                               -> { results: [{ key, to, ok, error?, problem?, retry? }] }
//        an email is looked up in Slack (users.lookupByEmail) and sent by DM.
//        <gio-mention:email|Name> in the text or blocks becomes that person's
//        Slack tag, or their name when they aren't in Slack.
// ASCII only.

import { createClient } from 'npm:@supabase/supabase-js@2'

// ---------- Slack, as in _shared/slack.ts (kept self-contained here; keep in step) ----------
// deno-lint-ignore no-explicit-any
type SlackResult = { ok: boolean; error?: string; [k: string]: any }

async function slackApi(token: string, method: string, body: Record<string, unknown> = {}): Promise<SlackResult> {
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

function slackProblem(code: string | undefined, where?: string): string {
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
      return 'Slack disconnected Gio. Reconnect it in Gio ATS, Settings > Integrations.'
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

const RETRYABLE = new Set(['ratelimited', 'internal_error', 'fatal_error', 'service_unavailable', 'request_timeout'])
const AUTH_GONE = new Set(['invalid_auth', 'token_revoked', 'account_inactive', 'not_authed'])

function plainText(mrkdwn: string): string {
  return mrkdwn
    .replace(/<!date\^\d+\^[^|]*\|([^>]*)>/g, '$1')
    .replace(/<[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<@[A-Z0-9]+>/g, '@someone')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .slice(0, 3000)
}

/** Posts to a channel, or to a person by DM. */
async function postTo(token: string, target: { channel?: string; user?: string; label: string }, text: string, blocks: unknown[]) {
  let channel = target.channel
  if (!channel && target.user) {
    const open = await slackApi(token, 'conversations.open', { users: target.user })
    if (!open.ok) return { to: target.label, ok: false, error: open.error, problem: slackProblem(open.error, target.label) }
    channel = open.channel?.id
  }
  if (!channel) return { to: target.label, ok: false, error: 'channel_not_found', problem: slackProblem('channel_not_found', target.label) }
  const r = await slackApi(token, 'chat.postMessage', { channel, text: plainText(text), blocks, unfurl_links: false, unfurl_media: false })
  return r.ok
    ? { to: target.label, ok: true, ts: r.ts as string }
    : { to: target.label, ok: false, error: r.error, problem: slackProblem(r.error, target.label) }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const SLACK_ID = /^[CGDUW][A-Z0-9]{4,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Target = { type: 'channel' | 'user'; id: string; label?: string } | { type: 'email'; email: string; label?: string }
type Message = { key?: string; to: Target; text: string; blocks?: unknown[] }

/** Channels Gio can see and the workspace's people, for the builder's pickers. */
async function directory(token: string) {
  const channels: Array<{ id: string; name: string; is_private: boolean; is_member: boolean }> = []
  let cursor: string | undefined
  for (let i = 0; i < 5; i++) {
    const r = await slackApi(token, 'conversations.list', {
      types: 'public_channel,private_channel', exclude_archived: 'true', limit: '1000', cursor,
    })
    if (!r.ok) return { error: r.error as string }
    for (const c of r.channels ?? []) channels.push({ id: c.id, name: c.name, is_private: !!c.is_private, is_member: !!c.is_member })
    cursor = r.response_metadata?.next_cursor || undefined
    if (!cursor) break
  }
  const users: Array<{ id: string; name: string; handle: string; title: string | null; avatar: string | null; email: string | null }> = []
  cursor = undefined
  for (let i = 0; i < 5; i++) {
    const r = await slackApi(token, 'users.list', { limit: '500', cursor })
    if (!r.ok) return { error: r.error as string }
    for (const u of r.members ?? []) {
      if (u.deleted || u.is_bot || u.id === 'USLACKBOT') continue
      users.push({
        id: u.id,
        name: u.profile?.real_name || u.real_name || u.name,
        handle: u.profile?.display_name || u.name,
        title: u.profile?.title || null,
        avatar: u.profile?.image_48 || null,
        email: u.profile?.email ? String(u.profile.email).toLowerCase() : null,
      })
    }
    cursor = r.response_metadata?.next_cursor || undefined
    if (!cursor) break
  }
  channels.sort((a, b) => a.name.localeCompare(b.name))
  users.sort((a, b) => a.name.localeCompare(b.name))
  return { channels, users }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const secret = Deno.env.get('GIO_LINK_SECRET')
  const tenant = Deno.env.get('GIO_ATS_TENANT_ID')
  if (!secret || !tenant) return json({ error: 'Not configured', code: 'not_configured' }, 503)

  const raw = await req.text()
  const ts = Number(req.headers.get('x-gio-timestamp') || '0')
  const sig = (req.headers.get('x-gio-signature') || '').trim().toLowerCase()
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300 || !sig || !safeEqual(sig, await hmac(secret, `${ts}.${raw}`))) {
    return json({ error: 'Invalid signature', code: 'signature' }, 401)
  }
  let body: Record<string, unknown>
  try { body = JSON.parse(raw) } catch { return json({ error: 'Invalid JSON' }, 400) }
  const action = String(body.action ?? '')

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: conn } = await db.from('slack_connections')
    .select('status, status_detail, team_name, team_domain, team_icon')
    .eq('tenant_id', tenant).is('removed_at', null).maybeSingle()

  if (action === 'status') {
    return json(conn
      ? { connected: true, status: conn.status, status_detail: conn.status_detail, team_name: conn.team_name, team_domain: conn.team_domain, team_icon: conn.team_icon }
      : { connected: false })
  }

  if (!conn || conn.status !== 'active') return json({ error: "Slack isn't connected in Gio ATS.", code: 'not_connected' }, 409)
  const { data: tok } = await db.rpc('slack_connection_token', { _tenant: tenant })
  const token = (tok as { token?: string } | null)?.token
  if (!token) return json({ error: "Slack isn't connected in Gio ATS.", code: 'not_connected' }, 409)
  const broken = async (code: string) => {
    if (AUTH_GONE.has(code)) await db.rpc('slack_connection_broken', { _tenant: tenant, _detail: code })
  }

  if (action === 'directory') {
    const dir = await directory(token)
    if ('error' in dir) {
      await broken(String(dir.error))
      return json({ error: "Slack didn't send the list. Try again.", code: dir.error }, 502)
    }
    return json(dir)
  }

  if (action === 'send') {
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(0, 25) as Message[]
    const ids = new Map<string, string | null>()
    const lookup = async (raw: string) => {
      const email = raw.toLowerCase()
      if (!ids.has(email)) {
        const r = await slackApi(token, 'users.lookupByEmail', { email })
        ids.set(email, r.ok && r.user?.id && !r.user.deleted ? String(r.user.id) : null)
        if (!r.ok) await broken(String(r.error))
      }
      return ids.get(email) ?? null
    }
    // Gio Sales writes people as <gio-mention:email|Name>; Slack gets <@U...> or the name.
    const MENTION = /<gio-mention:([^|>]+)\|([^>]*)>/g
    const mentions = async (s: string) => {
      const found = [...s.matchAll(MENTION)]
      if (!found.length) return s
      const tags = new Map<string, string | null>()
      for (const m of found) if (!tags.has(m[1]) && EMAIL.test(m[1])) tags.set(m[1], await lookup(m[1]))
      return s.replace(MENTION, (_w, email: string, name: string) => {
        const id = tags.get(email)
        return id ? `<@${id}>` : name
      })
    }
    const results = []
    for (const m of messages) {
      const to = m?.to as Target | undefined
      const label = String(to?.label ?? '').slice(0, 120) || 'Slack'
      const text = (await mentions(String(m?.text ?? ''))).slice(0, 3000)
      const blocks = Array.isArray(m?.blocks)
        ? JSON.parse(await mentions(JSON.stringify(m.blocks.slice(0, 10))))
        : [{ type: 'section', text: { type: 'mrkdwn', text } }]
      if (!to || !text.trim()) { results.push({ key: m?.key, to: label, ok: false, error: 'bad_request', problem: 'Nothing to send.' }); continue }
      let target: { channel?: string; user?: string; label: string } | null = null
      if ((to.type === 'channel' || to.type === 'user') && SLACK_ID.test(String(to.id))) {
        target = to.type === 'channel' ? { channel: to.id, label } : { user: to.id, label }
      } else if (to.type === 'email' && EMAIL.test(String(to.email))) {
        const email = String(to.email).toLowerCase()
        const id = await lookup(email)
        if (!id) { results.push({ key: m.key, to: label, ok: false, error: 'users_not_found', problem: `${label} isn't in your Slack with ${email}.` }); continue }
        target = { user: id, label }
      }
      if (!target) { results.push({ key: m.key, to: label, ok: false, error: 'bad_request', problem: slackProblem('channel_not_found', label) }); continue }
      const r = await postTo(token, target, text, blocks)
      if (!r.ok) await broken(String(r.error))
      results.push({ key: m.key, ...r, retry: !r.ok && RETRYABLE.has(String(r.error)) })
    }
    return json({ results })
  }

  return json({ error: 'Unknown action' }, 400)
})
