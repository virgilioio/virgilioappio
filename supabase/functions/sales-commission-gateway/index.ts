/**
 * Commission gateway for Gio Sales (commissions phase 2, 2026-10-31).
 *
 * A member's invoice to Virgilio's US company is written in Gio Sales, but
 * what goes on it lives here in Gio ATS. Gio Sales' server asks this function
 * for exactly two things, naming the member and the person asking by email:
 *
 *   invoice_details { email, actor_email, invoice } -> { found, name, email,
 *                   address, tax_id, tax_label, bank (masked: last4 only),
 *                   missing: [...] }   os_member_invoice_details: the tax
 *                   address (or the shipping address when it's the same), the
 *                   tax ID in full only when nothing is missing (written to
 *                   the audit log for that invoice), never the full account.
 *   reveal_bank     { email, actor_email, payout_id } -> { account }
 *                   os_member_bank_reveal: only a People & Access admin or
 *                   active Gio Sales Billing (GBK01), written to the audit log.
 *
 * Auth: x-gio-timestamp (unix seconds) and x-gio-signature, the hex
 * HMAC-SHA256 of `${timestamp}.${rawBody}` with GIO_LINK_SECRET, as the
 * Google and Sign gateways; anything older than 5 minutes is refused. Nothing
 * here is ever logged with its values.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_SKEW_SECONDS = 300

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
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

const email = (v: unknown) => (typeof v === 'string' && /^[^@\s]+@[^@\s]+$/.test(v.trim()) ? v.trim().toLowerCase() : null)

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
  const member = email(p.email)
  const actor = email(p.actor_email)
  if (!member || !actor) return json({ error: 'email and actor_email are required.', code: 'bad_request' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (p.action === 'invoice_details') {
    const { data, error } = await db.rpc('os_member_invoice_details', {
      _email: member,
      _actor_email: actor,
      _invoice: typeof p.invoice === 'string' ? p.invoice.slice(0, 40) : null,
    })
    if (error) {
      console.error('[sales-commission-gateway] invoice_details failed', error.code)
      return json({ error: "Couldn't read the member's details.", code: 'internal' }, 500)
    }
    return json(data)
  }

  if (p.action === 'reveal_bank') {
    const payout = typeof p.payout_id === 'string' && /^[0-9a-f-]{36}$/i.test(p.payout_id) ? p.payout_id : null
    if (!payout) return json({ error: 'payout_id is required.', code: 'bad_request' }, 400)
    const { data, error } = await db.rpc('os_member_bank_reveal', { _email: member, _actor_email: actor, _payout: payout })
    if (error) {
      if (error.code === 'GBK01') return json({ error: error.message, code: 'forbidden' }, 403)
      if (error.code === 'GBK02') return json({ error: error.message, code: 'no_bank' }, 404)
      console.error('[sales-commission-gateway] reveal_bank failed', error.code)
      return json({ error: "Couldn't reveal the account.", code: 'internal' }, 500)
    }
    return json({ account: data })
  }

  return json({ error: 'Unknown action.', code: 'bad_request' }, 400)
})
