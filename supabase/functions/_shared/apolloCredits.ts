/**
 * Apollo credits as Apollo bills them (Find Phase 0, 2026-10-11).
 *
 * - The balance comes from `apollo_credit_status()` (the workspace's plan and
 *   cycle, minus the ledger). The app reads the same function.
 * - Every Apollo call that costs credits writes one ledger row with what
 *   Apollo reported (`credits_consumed`), or an estimate when Apollo reports
 *   nothing (a phone delivered by webhook costs 8).
 * - Phone webhooks carry the workspace and a signature in their URL, so the
 *   webhook only fills phones for that workspace and nobody else can call it.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

/** Apollo's price per person, used to check a request fits before sending it. */
export const PERSON_CREDITS = 1
export const PHONE_CREDITS = 8

export interface CreditStatus {
  configured: boolean
  monthly_credits: number
  reserve_credits: number
  cycle_start: string | null
  cycle_end: string | null
  used: number
  remaining: number
}

export async function creditStatus(admin: SupabaseClient, tenantId: string): Promise<CreditStatus> {
  const { data, error } = await admin.rpc('apollo_credit_status', { p_tenant: tenantId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? {
    configured: false, monthly_credits: 0, reserve_credits: 0,
    cycle_start: null, cycle_end: null, used: 0, remaining: 0,
  }) as CreditStatus
}

/** What one Apollo response cost: Apollo's own figure, else the fallback. */
export function creditsFromResponse(body: unknown, fallback: number): { credits: number; estimated: boolean } {
  const reported = (body as { credits_consumed?: unknown } | null)?.credits_consumed
  if (typeof reported === 'number' && Number.isFinite(reported) && reported >= 0) {
    return { credits: Math.round(reported), estimated: false }
  }
  return { credits: Math.max(0, Math.round(fallback)), estimated: true }
}

export interface LedgerEntry {
  tenantId: string
  kind: 'collect' | 'phone' | 'enrich' | 'refresh'
  people: number
  credits: number
  estimated: boolean
  userId?: string | null
  projectId?: string | null
  candidateId?: string | null
  note?: string | null
}

/** Records spend. Never throws: a failed ledger write must not lose a collect. */
export async function recordCredits(admin: SupabaseClient, e: LedgerEntry): Promise<void> {
  if (e.credits <= 0 && e.people <= 0) return
  const { error } = await admin.from('apollo_credit_ledger').insert({
    tenant_id: e.tenantId,
    kind: e.kind,
    people: Math.max(0, e.people),
    credits: Math.max(0, e.credits),
    estimated: e.estimated,
    user_id: e.userId ?? null,
    sourcing_project_id: e.projectId ?? null,
    candidate_id: e.candidateId ?? null,
    note: e.note ? e.note.slice(0, 500) : null,
  })
  if (error) console.error('apollo_credit_ledger insert failed:', error.message)
}

async function hmacHex(message: string): Promise<string> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(`apollo-phone-webhook:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The webhook URL Apollo calls back with phones for this workspace. */
export async function phoneWebhookUrl(tenantId: string, userId?: string | null, projectId?: string | null): Promise<string> {
  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apollo-phone-webhook`
  const params = new URLSearchParams({ t: tenantId })
  if (userId) params.set('u', userId)
  if (projectId) params.set('p', projectId)
  params.set('s', await hmacHex(params.toString()))
  return `${base}?${params.toString()}`
}

/** Checks a webhook URL's signature; returns its workspace, or null. */
export async function verifyPhoneWebhook(url: URL): Promise<{ tenantId: string; userId: string | null; projectId: string | null } | null> {
  const t = url.searchParams.get('t')
  const s = url.searchParams.get('s')
  if (!t || !s) return null
  const params = new URLSearchParams({ t })
  const u = url.searchParams.get('u')
  const p = url.searchParams.get('p')
  if (u) params.set('u', u)
  if (p) params.set('p', p)
  const expected = await hmacHex(params.toString())
  if (expected.length !== s.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ s.charCodeAt(i)
  return diff === 0 ? { tenantId: t, userId: u, projectId: p } : null
}
