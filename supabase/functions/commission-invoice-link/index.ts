/**
 * Commission invoice link (commissions phase 3, 2026-10-31).
 *
 * My profile's Invoices view opens the invoice Gio wrote in a member's name
 * (or their own uploaded one). The file stays in Gio Sales; this function
 * checks who is asking and asks Gio Sales' commission-member-file for a
 * 5-minute link.
 *
 * POST { payout_id, which: 'invoice' | 'own' }  (payout_id: os_commission_payouts.id)
 *   -> { url, filename }
 * Who: the payout's member or a People & Access admin. The payout is read
 * with the caller's own token, so os_commission_payouts' policy decides; a
 * payout someone can't see reads as missing.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f-]{36}$/i

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401)

  let p: Record<string, unknown>
  try {
    p = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const id = typeof p.payout_id === 'string' && UUID.test(p.payout_id) ? p.payout_id : null
  const which = p.which === 'own' ? 'own' : p.which === 'invoice' ? 'invoice' : null
  if (!id || !which) return json({ error: 'Which invoice?' }, 400)

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: payout, error } = await userClient
    .from('os_commission_payouts')
    .select('sales_payout_id, person_email, status, has_invoice_pdf, has_own_invoice')
    .eq('id', id)
    .maybeSingle()
  if (error) return json({ error: "Couldn't open the invoice. Try again." }, 500)
  if (!payout || !payout.person_email) return json({ error: 'There is no such invoice.', code: 'unavailable' }, 404)
  if (which === 'invoice' ? !payout.has_invoice_pdf : !payout.has_own_invoice) {
    return json({ error: 'There is no such invoice.', code: 'unavailable' }, 404)
  }

  const base = (Deno.env.get('GIO_SALES_URL') || '').replace(/\/+$/, '')
  const secret = Deno.env.get('GIO_LINK_SECRET')
  if (!base || !secret) return json({ error: "Couldn't reach Gio Sales. Try again in a moment.", code: 'gateway' }, 503)
  const body = JSON.stringify({ payout_id: payout.sales_payout_id, member_email: payout.person_email, which })
  const ts = String(Math.floor(Date.now() / 1000))
  let res: Response
  try {
    res = await fetch(`${base}/functions/v1/commission-member-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-gio-timestamp': ts, 'x-gio-signature': await hmac(secret, `${ts}.${body}`) },
      body,
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return json({ error: "Couldn't reach Gio Sales. Try again in a moment.", code: 'gateway' }, 502)
  }
  const out = await res.json().catch(() => ({}))
  if (!res.ok || typeof out.url !== 'string') {
    return json({ error: res.status === 404 ? 'There is no such invoice.' : "Couldn't open the invoice. Try again.", code: out.code ?? 'gateway' }, res.status === 404 ? 404 : 502)
  }
  return json({ url: out.url, filename: out.filename })
})
