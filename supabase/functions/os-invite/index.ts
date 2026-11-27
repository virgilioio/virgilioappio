/**
 * People & Access -> one person's invitation in Gio Sales or Gio Docs (2026-11-27).
 *
 * POST { tenant_id, user_id, app: 'sales' | 'docs', action: 'status' | 'link' | 'renew' }
 * with the admin's own token. os_invite_request() decides who may ask (People &
 * Access admins, never about themselves, an app the person has) and writes link
 * and renew to the history; this then asks the app's os-provision (kind
 * 'invite'), signed over `${timestamp}.${body}` with that app's secret as
 * os-sync does, and answers what the app says:
 *   { state: joined | pending | expired | withdrawn | none | switched_off,
 *     invited_at, sent_at, expires_at, url (for link) }
 * The link is never stored here. Keep this file ASCII only.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  })

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
}

const APP_NAME: Record<string, string> = { sales: 'Gio Sales', docs: 'Gio Docs' }

/** Where each app receives People & Access requests (the same settings as os-sync). */
function target(app: string): { url: string; secret: string } | null {
  const env = app === 'sales'
    ? { url: Deno.env.get('GIO_SALES_URL'), secret: Deno.env.get('OS_PROVISION_SECRET_SALES') }
    : app === 'docs'
      ? { url: Deno.env.get('GIO_DOCS_URL') || 'https://fzbsautaxfuqnjkchske.supabase.co', secret: Deno.env.get('OS_PROVISION_SECRET_DOCS') }
      : { url: undefined, secret: undefined }
  if (!env.url || !env.secret) return null
  return { url: env.url.replace(/\/+$/, ''), secret: env.secret }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in to continue.' }, 401)

  let p: Record<string, unknown> = {}
  try { p = await req.json() } catch { return json({ error: 'Invalid JSON.' }, 400) }
  const tenantId = String(p.tenant_id ?? '')
  const userId = String(p.user_id ?? '')
  const app = String(p.app ?? '')
  const action = String(p.action ?? '')

  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: who, error } = await userClient.rpc('os_invite_request', {
    _tenant_id: tenantId, _user_id: userId, _app: app, _action: action,
  })
  if (error) {
    const status = error.code === '42501' ? 403 : 400
    return json({ error: error.message, code: error.code }, status)
  }
  const { email, actor_email } = who as { email: string; actor_email: string | null }
  if (!actor_email) return json({ error: 'Your account has no email address.' }, 400)

  const dest = target(app)
  if (!dest) return json({ state: 'unknown', detail: `${APP_NAME[app]} isn't connected to People & Access yet.` })

  const body = JSON.stringify({ kind: 'invite', action, email, actor_email })
  const ts = String(Math.floor(Date.now() / 1000))
  let res: Response
  try {
    res = await fetch(`${dest.url}/functions/v1/os-provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-gio-timestamp': ts, 'x-gio-signature': await hmac(dest.secret, `${ts}.${body}`) },
      body,
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    return json({ error: `${APP_NAME[app]} can't be reached right now. Try again in a minute.` }, 502)
  }
  const answer = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) {
    return json({ error: `${APP_NAME[app]} couldn't answer right now. Try again in a minute.` }, 502)
  }
  if (answer.outcome === 'refused') {
    return json({ error: typeof answer.detail === 'string' ? answer.detail : `${APP_NAME[app]} refused.`, code: 'refused' }, 403)
  }
  return json({
    state: answer.state ?? 'unknown',
    invited_at: answer.invited_at ?? null,
    sent_at: answer.sent_at ?? null,
    expires_at: answer.expires_at ?? null,
    url: typeof answer.url === 'string' ? answer.url : null,
  })
})
