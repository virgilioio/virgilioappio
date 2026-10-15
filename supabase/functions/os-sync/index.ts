/**
 * People & Access -> the apps that enforce access (design Part D, 2026-10-14).
 *
 * Sends queued changes (os_sync_queue) to Gio Sales' `os-provision` function,
 * signed with OS_PROVISION_SECRET_SALES over `${timestamp}.${body}`, and records
 * each answer with os_sync_record(), which moves the grant to active or error.
 * The queue item id is the request id, so a retry is never applied twice.
 * Gio Docs items wait until its receiver exists.
 *
 * Called by:
 *   - People & Access right after a change: POST { tenant_id } with the admin's token;
 *   - pg_cron every few minutes: x-internal-secret (retries and anything missed).
 * Keep this file ASCII only: the deploy tool rewrites escape sequences.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

type Item = { id: string; tenant_id: string; user_id: string; app_key: string; role: string | null; actor_user_id: string; attempts: number }

/** Plain words for what Gio Sales did, kept short for the person's page. */
function refusalText(body: Record<string, unknown>): string {
  const detail = typeof body.detail === 'string' ? body.detail : typeof body.error === 'string' ? body.error : ''
  return (detail || 'Gio Sales refused this change.').slice(0, 480)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // Who is asking: the cron (internal secret) or an admin of the workspace.
  let tenantId: string | null = null
  const internal = Deno.env.get('INTERNAL_FUNCTION_SECRET')
  const isCron = !!internal && req.headers.get('x-internal-secret') === internal
  if (!isCron) {
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in to continue.' }, 401)
    let p: Record<string, unknown> = {}
    try { p = await req.json() } catch { /* empty body */ }
    tenantId = typeof p.tenant_id === 'string' ? p.tenant_id : null
    if (!tenantId) return json({ error: 'tenant_id is required.' }, 400)
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    })
    const { data: ok, error } = await userClient.rpc('is_os_admin', { _tenant_id: tenantId })
    if (error || ok !== true) return json({ error: 'Only admins can change access.' }, 403)
  }

  const salesUrl = (Deno.env.get('GIO_SALES_URL') || '').replace(/\/+$/, '')
  const secret = Deno.env.get('OS_PROVISION_SECRET_SALES') || ''
  if (!salesUrl || !secret) return json({ error: 'Gio Sales provisioning is not configured.' }, 503)

  let q = admin
    .from('os_sync_queue')
    .select('id, tenant_id, user_id, app_key, role, actor_user_id, attempts')
    .eq('status', 'pending')
    .eq('app_key', 'sales')
    .order('created_at')
    .limit(50)
  if (tenantId) q = q.eq('tenant_id', tenantId)
  const { data: items, error: qErr } = await q
  if (qErr) return json({ error: qErr.message }, 500)

  const emailCache = new Map<string, string | null>()
  const emailOf = async (id: string) => {
    if (emailCache.has(id)) return emailCache.get(id) ?? null
    const { data } = await admin.auth.admin.getUserById(id)
    const email = data?.user?.email?.toLowerCase() ?? null
    emailCache.set(id, email)
    return email
  }

  const results: Array<{ id: string; result: string }> = []
  for (const item of (items ?? []) as Item[]) {
    // Back off: after 3 failed attempts, only the cron retries (every few minutes).
    if (!isCron && item.attempts >= 3) continue
    const [email, actorEmail] = await Promise.all([emailOf(item.user_id), emailOf(item.actor_user_id)])
    if (!email || !actorEmail) {
      await admin.rpc('os_sync_record', { _id: item.id, _ok: false, _outcome: 'refused', _detail: 'This person has no email address.', _retry: false })
      results.push({ id: item.id, result: 'refused' })
      continue
    }

    const body = JSON.stringify({ request_id: item.id, email, role: item.role, actor_email: actorEmail })
    const ts = String(Math.floor(Date.now() / 1000))
    let res: Response
    try {
      res = await fetch(`${salesUrl}/functions/v1/os-provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gio-timestamp': ts, 'x-gio-signature': await hmac(secret, `${ts}.${body}`) },
        body,
        signal: AbortSignal.timeout(20_000),
      })
    } catch (e) {
      await admin.rpc('os_sync_record', { _id: item.id, _ok: false, _outcome: null, _detail: String(e).slice(0, 480), _retry: true })
      results.push({ id: item.id, result: 'retry' })
      continue
    }

    const text = await res.text()
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(text) } catch { parsed = { error: text.slice(0, 300) } }

    if (res.ok && parsed.ok === true) {
      await admin.rpc('os_sync_record', { _id: item.id, _ok: true, _outcome: String(parsed.outcome ?? ''), _detail: null, _retry: false })
      results.push({ id: item.id, result: String(parsed.outcome ?? 'done') })
    } else if (res.ok || res.status === 400) {
      // Gio Sales answered and said no (its own rules, or a bad request).
      await admin.rpc('os_sync_record', { _id: item.id, _ok: false, _outcome: 'refused', _detail: refusalText(parsed), _retry: false })
      results.push({ id: item.id, result: 'refused' })
    } else {
      // Unreachable, not configured, or a signature/clock problem: keep it queued.
      await admin.rpc('os_sync_record', { _id: item.id, _ok: false, _outcome: null, _detail: `HTTP ${res.status}: ${refusalText(parsed)}`.slice(0, 480), _retry: true })
      results.push({ id: item.id, result: 'retry' })
    }
  }

  return json({ ok: true, processed: results.length, results })
})
