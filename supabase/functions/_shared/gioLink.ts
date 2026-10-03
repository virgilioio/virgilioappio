// Shared helpers for the signed Gio Sales <-> Gio ATS link.
import { createClient } from 'npm:@supabase/supabase-js@2'

export const linkCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-gio-signature, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...linkCors, 'Content-Type': 'application/json' } })
}

export function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

export function tenantId(): string {
  const t = Deno.env.get('GIO_ATS_TENANT_ID')
  if (!t) throw new Error('GIO_ATS_TENANT_ID is not configured')
  return t
}

async function hmacHex(body: string): Promise<string> {
  const secret = Deno.env.get('GIO_LINK_SECRET')
  if (!secret) throw new Error('GIO_LINK_SECRET is not configured')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const sign = hmacHex

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/** Verifies x-gio-signature over the raw body (GET: over the query string). */
export async function verify(req: Request, raw: string): Promise<boolean> {
  const got = (req.headers.get('x-gio-signature') || '').trim().toLowerCase().replace(/^sha256=/, '')
  if (!got) return false
  return safeEqual(got, await hmacHex(raw))
}

/** Returns a stored response for a repeated idempotency key, or null. */
export async function inboxGet(db: ReturnType<typeof admin>, key: string) {
  const { data } = await db.from('integration_inbox').select('status_code, response').eq('idempotency_key', key).maybeSingle()
  return data ? json(data.response, data.status_code) : null
}

export async function inboxPut(db: ReturnType<typeof admin>, key: string, endpoint: string, response: unknown, status = 200) {
  await db.from('integration_inbox').upsert({ idempotency_key: key, endpoint, response, status_code: status }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
}
