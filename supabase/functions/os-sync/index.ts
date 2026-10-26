/**
 * People & Access -> the apps that enforce access (design Part D, 2026-10-14).
 *
 * Sends queued changes (os_sync_queue) to each app's `os-provision` function,
 * signed over `${timestamp}.${body}` with that app's own secret, and records
 * each answer with os_sync_record(), which moves the grant to active or error.
 * The queue item id is the request id, so a retry is never applied twice.
 * An item marked resend (os_resend_access) asks the app to send its
 * invitation again; the app's own message comes back as detail.
 *   Gio Sales: GIO_SALES_URL + OS_PROVISION_SECRET_SALES
 *   Gio Docs:  GIO_DOCS_URL (defaults to its Supabase URL) + OS_PROVISION_SECRET_DOCS
 * An app whose URL or secret isn't set yet is skipped; its items wait.
 * It also delivers new commission rates (os_commission_rates) to Gio Sales,
 * kind 'commission_rate' on the same endpoint, settled by os_commission_rate_record,
 * then commission roles and rule versions (2026-10-26), kinds 'commission_role'
 * and 'commission_rule' as { kind, item }, settled by os_commission_role_record
 * (only the version that was sent) and os_commission_rule_record. Roles go first;
 * a rule whose role Gio Sales doesn't have yet answers 409 and waits.
 * On the cron run it also emails people whose bank details or tax IDs someone
 * else changed (os_bank_alerts through os_account_alerts_claim, see bankAlert.ts).
 *
 * Called by:
 *   - People & Access right after a change: POST { tenant_id } with the admin's token;
 *   - pg_cron every few minutes: x-internal-secret (retries and anything missed).
 * Keep this file ASCII only: the deploy tool rewrites escape sequences.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { bankAlertMessage, taxIdAlertMessage, type BankAlert } from './bankAlert.ts'

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

type Item = { id: string; tenant_id: string; user_id: string; app_key: string; role: string | null; actor_user_id: string; attempts: number; resend: boolean }

const APP_NAME: Record<string, string> = { sales: 'Gio Sales', docs: 'Gio Docs' }

/** Where each app receives grants, or null while it isn't configured. */
function target(app: string): { url: string; secret: string } | null {
  const env = app === 'sales'
    ? { url: Deno.env.get('GIO_SALES_URL'), secret: Deno.env.get('OS_PROVISION_SECRET_SALES') }
    : app === 'docs'
      ? { url: Deno.env.get('GIO_DOCS_URL') || 'https://fzbsautaxfuqnjkchske.supabase.co', secret: Deno.env.get('OS_PROVISION_SECRET_DOCS') }
      : { url: undefined, secret: undefined }
  if (!env.url || !env.secret) return null
  return { url: env.url.replace(/\/+$/, ''), secret: env.secret }
}

/** Claims waiting account alerts (os_account_alerts_claim), emails each person from
 *  Gio's no-reply address and settles it. A failure is retried, up to five times. */
// deno-lint-ignore no-explicit-any
async function sendBankAlerts(admin: any): Promise<Array<{ id: string; result: string }>> {
  const out: Array<{ id: string; result: string }> = []
  const { data, error } = await admin.rpc('os_account_alerts_claim', { _limit: 20 })
  if (error) {
    console.error('os-sync bank alerts', error.message)
    return out
  }
  const key = Deno.env.get('RESEND_API_KEY')
  const address = Deno.env.get('EMAIL_DEFAULT_FROM_ADDRESS') || 'noreply@app.gogio.io'
  for (const a of (data ?? []) as BankAlert[]) {
    try {
      if (!a.to_email) {
        await admin.rpc('os_bank_alerts_finish', { _id: a.alert_id, _ok: true })
        out.push({ id: a.alert_id, result: 'no email' })
        continue
      }
      if (!key) throw new Error('RESEND_API_KEY missing')
      const m = a.kind === 'bank' ? bankAlertMessage(a) : taxIdAlertMessage(a)
      const { Resend } = await import('npm:resend@2.0.0')
      const res = await new Resend(key).emails.send({ from: `Gio <${address}>`, to: [a.to_email], subject: m.subject, html: m.html, text: m.text })
      // deno-lint-ignore no-explicit-any
      const err = (res as any)?.error
      if (err) throw new Error(JSON.stringify(err).slice(0, 400))
      await admin.rpc('os_bank_alerts_finish', { _id: a.alert_id, _ok: true })
      out.push({ id: a.alert_id, result: 'sent' })
    } catch (e) {
      await admin.rpc('os_bank_alerts_finish', { _id: a.alert_id, _ok: false, _error: String(e).slice(0, 480) })
      out.push({ id: a.alert_id, result: 'retry' })
    }
  }
  return out
}

/** Plain words for what the app did, kept short for the person's page. */
function refusalText(app: string, body: Record<string, unknown>): string {
  const detail = typeof body.detail === 'string' ? body.detail : typeof body.error === 'string' ? body.error : ''
  return (detail || `${APP_NAME[app] ?? 'The app'} refused this change.`).slice(0, 480)
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

  // Bank details or tax IDs changed by someone else: email the person (the bell rang already).
  const alerts = isCron ? await sendBankAlerts(admin) : []

  const apps = ['sales', 'docs'].filter((a) => target(a))
  if (apps.length === 0) return json({ error: 'No app is configured to receive grants.', alerts }, 503)

  let q = admin
    .from('os_sync_queue')
    .select('id, tenant_id, user_id, app_key, role, actor_user_id, attempts, resend')
    .eq('status', 'pending')
    .in('app_key', apps)
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

  const results: Array<{ id: string; result: string; detail?: string | null }> = []
  for (const item of (items ?? []) as Item[]) {
    // Back off: after 3 failed attempts, only the cron retries (every few minutes).
    if (!isCron && item.attempts >= 3) continue
    const [email, actorEmail] = await Promise.all([emailOf(item.user_id), emailOf(item.actor_user_id)])
    if (!email || !actorEmail) {
      await admin.rpc('os_sync_record', { _id: item.id, _ok: false, _outcome: 'refused', _detail: 'This person has no email address.', _retry: false })
      results.push({ id: item.id, result: 'refused', detail: 'This person has no email address.' })
      continue
    }

    const dest = target(item.app_key)!
    const body = JSON.stringify({ request_id: item.id, email, role: item.role, actor_email: actorEmail, ...(item.resend ? { resend: true } : {}) })
    const ts = String(Math.floor(Date.now() / 1000))
    let res: Response
    try {
      res = await fetch(`${dest.url}/functions/v1/os-provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-gio-timestamp': ts, 'x-gio-signature': await hmac(dest.secret, `${ts}.${body}`) },
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
      results.push({ id: item.id, result: String(parsed.outcome ?? 'done'), detail: typeof parsed.detail === 'string' ? parsed.detail : null })
    } else if (res.ok || res.status === 400) {
      // The app answered and said no (its own rules, or a bad request).
      await admin.rpc('os_sync_record', { _id: item.id, _ok: false, _outcome: 'refused', _detail: refusalText(item.app_key, parsed), _retry: false })
      results.push({ id: item.id, result: 'refused', detail: refusalText(item.app_key, parsed) })
    } else {
      // Unreachable, not configured, or a signature/clock problem: keep it queued.
      await admin.rpc('os_sync_record', { _id: item.id, _ok: false, _outcome: null, _detail: `HTTP ${res.status}: ${refusalText(item.app_key, parsed)}`.slice(0, 480), _retry: true })
      results.push({ id: item.id, result: 'retry' })
    }
  }

  // Commission rates (2026-10-23): People & Access owns them, Gio Sales keeps
  // the copy its invoices use. Same endpoint and secret, kind 'commission_rate'.
  const sales = target('sales')
  const rates: Array<{ id: string; result: string; detail?: string | null }> = []
  if (sales) {
    let rq = admin
      .from('os_commission_rates')
      .select('id, tenant_id, role_key, pct, effective_from, note, created_by, sync_attempts')
      .eq('sync_status', 'pending')
      .order('created_at')
      .limit(50)
    if (tenantId) rq = rq.eq('tenant_id', tenantId)
    const { data: pending } = await rq
    for (const rate of (pending ?? []) as Array<{ id: string; role_key: string; pct: number; effective_from: string; note: string | null; created_by: string | null; sync_attempts: number }>) {
      if (!isCron && rate.sync_attempts >= 3) continue
      const actorEmail = rate.created_by ? await emailOf(rate.created_by) : null
      const body = JSON.stringify({
        kind: 'commission_rate',
        request_id: rate.id,
        role_key: rate.role_key,
        pct: Number(rate.pct),
        effective_from: rate.effective_from,
        note: rate.note,
        actor_email: actorEmail ?? '',
      })
      const ts = String(Math.floor(Date.now() / 1000))
      let res: Response
      try {
        res = await fetch(`${sales.url}/functions/v1/os-provision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-gio-timestamp': ts, 'x-gio-signature': await hmac(sales.secret, `${ts}.${body}`) },
          body,
          signal: AbortSignal.timeout(20_000),
        })
      } catch (e) {
        await admin.rpc('os_commission_rate_record', { _id: rate.id, _ok: false, _detail: String(e).slice(0, 480), _retry: true })
        rates.push({ id: rate.id, result: 'retry' })
        continue
      }
      const text = await res.text()
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(text) } catch { parsed = { error: text.slice(0, 300) } }
      if (res.ok && parsed.ok === true) {
        await admin.rpc('os_commission_rate_record', { _id: rate.id, _ok: true, _detail: null, _retry: false })
        rates.push({ id: rate.id, result: String(parsed.outcome ?? 'done') })
      } else if (res.ok || res.status === 400) {
        await admin.rpc('os_commission_rate_record', { _id: rate.id, _ok: false, _detail: refusalText('sales', parsed), _retry: false })
        rates.push({ id: rate.id, result: 'refused', detail: refusalText('sales', parsed) })
      } else {
        await admin.rpc('os_commission_rate_record', { _id: rate.id, _ok: false, _detail: `HTTP ${res.status}: ${refusalText('sales', parsed)}`.slice(0, 480), _retry: true })
        rates.push({ id: rate.id, result: 'retry' })
      }
    }
  }

  // Commission roles and rule versions (2026-10-26): roles first, so their rules find them.
  const commissions: Array<{ kind: string; id: string; result: string; detail?: string | null }> = []
  if (sales) {
    const post = async (kind: string, item: Record<string, unknown>) => {
      const body = JSON.stringify({ kind, item })
      const ts = String(Math.floor(Date.now() / 1000))
      try {
        const res = await fetch(`${sales.url}/functions/v1/os-provision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-gio-timestamp': ts, 'x-gio-signature': await hmac(sales.secret, `${ts}.${body}`) },
          body,
          signal: AbortSignal.timeout(20_000),
        })
        const text = await res.text()
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(text) } catch { parsed = { error: text.slice(0, 300) } }
        if (res.ok && parsed.ok === true) return { ok: true, retry: false, detail: null, result: String(parsed.outcome ?? 'done') }
        if (res.ok || res.status === 400) return { ok: false, retry: false, detail: refusalText('sales', parsed), result: 'refused' }
        return { ok: false, retry: true, detail: `HTTP ${res.status}: ${refusalText('sales', parsed)}`.slice(0, 480), result: 'retry' }
      } catch (e) {
        return { ok: false, retry: true, detail: String(e).slice(0, 480), result: 'retry' }
      }
    }

    let rq = admin
      .from('os_commission_roles')
      .select('id, key, label, description, person_source, built_in, active, position, updated_at, sync_attempts')
      .eq('sync_status', 'pending')
      .order('created_at')
      .limit(50)
    if (tenantId) rq = rq.eq('tenant_id', tenantId)
    const { data: roles } = await rq
    for (const role of (roles ?? []) as Array<Record<string, unknown> & { id: string; updated_at: string; sync_attempts: number }>) {
      if (!isCron && role.sync_attempts >= 3) continue
      const { sync_attempts: _attempts, ...item } = role
      const r = await post('commission_role', item)
      await admin.rpc('os_commission_role_record', { _id: role.id, _updated_at: role.updated_at, _ok: r.ok, _detail: r.detail, _retry: r.retry })
      commissions.push({ kind: 'role', id: role.id, result: r.result, detail: r.detail })
    }

    let uq = admin
      .from('os_commission_rules')
      .select('id, role_id, series_id, effective_from, stopped, basis, pct, amount, currency, payable_on, applies_to, fees, client, partner_items, months, note, created_by, created_at, sync_attempts')
      .eq('sync_status', 'pending')
      .order('created_at')
      .limit(100)
    if (tenantId) uq = uq.eq('tenant_id', tenantId)
    const { data: rules } = await uq
    for (const rule of (rules ?? []) as Array<Record<string, unknown> & { id: string; created_by: string | null; sync_attempts: number }>) {
      if (!isCron && rule.sync_attempts >= 3) continue
      const { sync_attempts: _attempts, created_by, ...item } = rule
      const actorEmail = created_by ? await emailOf(created_by) : null
      const r = await post('commission_rule', { ...item, actor_email: actorEmail ?? '' })
      await admin.rpc('os_commission_rule_record', { _id: rule.id, _ok: r.ok, _detail: r.detail, _retry: r.retry })
      commissions.push({ kind: 'rule', id: rule.id, result: r.result, detail: r.detail })
    }
  }

  return json({ ok: true, processed: results.length, results, rates, commissions, alerts })
})
