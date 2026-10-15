/**
 * One-click offboarding (design Part D, 2026-10-14). POST { tenant_id, user_id }
 * with the admin's token. Runs, in order, and records each step in
 * os_offboardings.steps:
 *   ats     os_offboard_ats(): job seats, Gio Sales / Gio Docs access queued
 *           for removal, ATS membership inactive, People & Access offboarded
 *   apps    sends the queued removals now (os-sync) and checks they landed
 *   signout blocks their ATS sign-in, which also ends their sessions
 *   google  revokes their Google connection with Google and removes it
 * Running it again repeats only what isn't done.
 *
 * POST { tenant_id, user_id, action: 'reactivate' } brings someone back:
 * os_reactivate_ats() (ATS membership active, People & Access active) and
 * their sign-in block is lifted. The page then applies the job role the admin
 * picked, which restores Gio Sales and Gio Docs access through os-sync.
 *
 * The guard (admins only, never
 * yourself, platform admins by platform admins, one admin always left) is in
 * the database, under the admin's own token.
 * Keep this file ASCII only: the deploy tool rewrites escape sequences.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  })

type Step = { status: 'done' | 'error'; at: string; detail?: string; [k: string]: unknown }
type Steps = Record<string, Step>
const ORDER = ['ats', 'apps', 'signout', 'google'] as const
const BANNED_FOR = '876000h' // about 100 years; reactivating lifts it

async function saveStep(admin: SupabaseClient, id: string, name: string, step: Step) {
  const { data } = await admin.from('os_offboardings').select('steps').eq('id', id).single()
  const steps = { ...((data?.steps ?? {}) as Steps), [name]: step }
  const finished = ORDER.every((s) => steps[s]?.status === 'done')
  await admin
    .from('os_offboardings')
    .update({ steps, finished_at: finished ? new Date().toISOString() : null })
    .eq('id', id)
  return steps
}

/** Revokes one Google refresh token. An already-dead token counts as revoked. */
async function revokeWithGoogle(admin: SupabaseClient, encrypted: string | null): Promise<string | null> {
  if (!encrypted) return null
  const { data: token, error } = await admin.rpc('decrypt_refresh_token', { encrypted_token: encrypted })
  if (error || !token) return 'Could not read the stored Google token.'
  const res = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: String(token) }),
    signal: AbortSignal.timeout(15_000),
  })
  if (res.ok) return null
  const text = await res.text()
  if (res.status === 400 && /invalid_token/.test(text)) return null
  return `Google answered ${res.status}.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in to continue.' }, 401)

  let p: Record<string, unknown> = {}
  try { p = await req.json() } catch { /* empty */ }
  const tenantId = typeof p.tenant_id === 'string' ? p.tenant_id : ''
  const userId = typeof p.user_id === 'string' ? p.user_id : ''
  if (!tenantId || !userId) return json({ error: 'tenant_id and user_id are required.' }, 400)

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const asAdmin = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  if (p.action === 'reactivate') {
    const { error: backError } = await asAdmin.rpc('os_reactivate_ats', { _tenant_id: tenantId, _user_id: userId })
    if (backError) return json({ error: backError.message, code: backError.code }, backError.code === '42501' ? 403 : 400)
    const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' } as never)
    if (unbanError) return json({ error: 'They are active again, but their sign-in is still blocked. Try again.' }, 500)
    return json({ ok: true })
  }

  // 1. ATS, under the admin's own token (the database checks who may do this).
  const { data: ats, error: atsError } = await asAdmin.rpc('os_offboard_ats', { _tenant_id: tenantId, _user_id: userId })
  if (atsError) return json({ error: atsError.message, code: atsError.code }, atsError.code === '42501' ? 403 : 400)
  const offId = (ats as { id: string }).id
  const now = () => new Date().toISOString()

  const { data: row } = await admin.from('os_offboardings').select('steps').eq('id', offId).single()
  let steps = (row?.steps ?? {}) as Steps

  // 2. Apps: send the queued removals now, then check what landed.
  if (steps.apps?.status !== 'done') {
    try {
      await fetch(`${url}/functions/v1/os-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ tenant_id: tenantId }),
        signal: AbortSignal.timeout(45_000),
      })
    } catch { /* checked below */ }
    const { data: left } = await admin
      .from('os_sync_queue')
      .select('app_key, status, last_error')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .in('status', ['pending', 'refused'])
      .is('role', null)
    const open = (left ?? []) as Array<{ app_key: string; status: string; last_error: string | null }>
    const refused = open.filter((q) => q.status === 'refused')
    const appName = (k: string) => (k === 'sales' ? 'Gio Sales' : k === 'docs' ? 'Gio Docs' : k)
    steps = await saveStep(admin, offId, 'apps', open.length === 0
      ? { status: 'done', at: now() }
      : {
          status: 'error',
          at: now(),
          detail: refused.length
            ? `${refused.map((q) => appName(q.app_key)).join(' and ')} refused: ${refused[0].last_error ?? 'no reason given'}`
            : `${open.map((q) => appName(q.app_key)).join(' and ')} not reached yet. It retries every 5 minutes.`,
        })
  }

  // 3. Sign-out: block their ATS sign-in; this also ends their sessions.
  if (steps.signout?.status !== 'done') {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: BANNED_FOR } as never)
    steps = await saveStep(admin, offId, 'signout', error
      ? { status: 'error', at: now(), detail: 'Couldn\'t block their sign-in.' }
      : { status: 'done', at: now() })
  }

  // 4. Google: revoke with Google, then remove the connection.
  if (steps.google?.status !== 'done') {
    const problems: string[] = []
    const [{ data: mail }, { data: cal }] = await Promise.all([
      admin.from('user_mail_identities').select('id, refresh_token_encrypted').eq('user_id', userId).eq('provider', 'gmail'),
      admin.from('calendar_identities').select('id, encrypted_refresh_token').eq('user_id', userId).eq('provider', 'google'),
    ])
    for (const m of (mail ?? []) as Array<{ id: string; refresh_token_encrypted: string | null }>) {
      const problem = await revokeWithGoogle(admin, m.refresh_token_encrypted)
      if (problem) problems.push(problem)
      else await admin.from('user_mail_identities').delete().eq('id', m.id)
    }
    for (const c of (cal ?? []) as Array<{ id: string; encrypted_refresh_token: string | null }>) {
      const problem = await revokeWithGoogle(admin, c.encrypted_refresh_token)
      if (problem) problems.push(problem)
      else await admin.from('calendar_identities').delete().eq('id', c.id)
    }
    steps = await saveStep(admin, offId, 'google', problems.length
      ? { status: 'error', at: now(), detail: `Couldn't revoke their Google connection: ${problems[0]}` }
      : { status: 'done', at: now(), mail: (mail ?? []).length, calendar: (cal ?? []).length })
  }

  return json({ ok: ORDER.every((s) => steps[s]?.status === 'done'), id: offId, steps })
})
