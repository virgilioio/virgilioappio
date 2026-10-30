// Slack for a workspace: connect, pick channels and people, send a test,
// disconnect (Allan, 2026-10-27).
//
// POST (signed in) { action, tenant_id, ... }
//   start       admins: the Slack sign-in address (sealed state) -> { url }
//   directory   admins and Recruiters: channels and people -> { channels, users }
//   test        whoever may edit that automation: sends it once with example
//               details; "the job's people" go to the sender by DM -> { results }
//   disconnect  admins: Slack forgets the token, Gio removes it.
// GET ?code&state   Slack's redirect after sign-in: saves the connection and
//                   sends the person back to Settings > Integrations.
//
// Who may do what is the database's call (slack_status, slack_check_edit run
// as the signed-in person); the token is only read with the service role.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createSecureCorsHeaders, handleSecureCorsPreFlight, isAllowedOrigin, withRequestCors } from '../_shared/cors.ts'
import {
  APP_URL, AUTH_GONE, SLACK_SCOPES, callbackUrl, deliver, openState, sealState, slackApi,
  type Destination, type MessageContext,
} from '../_shared/slack.ts'

const corsHeaders = createSecureCorsHeaders()

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  })
}

function asUser(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } },
  )
}

// deno-lint-ignore no-explicit-any
function dbMessage(error: any, fallback: string): string {
  const code = String(error?.code ?? '')
  if (code.startsWith('GSL') && error?.message) return String(error.message)
  return fallback
}

function back(origin: string, params: Record<string, string>): Response {
  const u = new URL('/settings', isAllowedOrigin(origin).allowed ? origin : APP_URL)
  u.searchParams.set('tab', 'integrations')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return new Response(null, { status: 302, headers: { Location: u.toString() } })
}

async function callback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const sealed = url.searchParams.get('state') ?? ''
  let state
  try {
    state = await openState(sealed)
  } catch {
    return back(APP_URL, { slack: 'error', reason: 'expired' })
  }
  if (url.searchParams.get('error')) return back(state.return_origin, { slack: 'cancelled' })
  const code = url.searchParams.get('code')
  const clientId = Deno.env.get('SLACK_CLIENT_ID')
  const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET')
  if (!code || !clientId || !clientSecret) return back(state.return_origin, { slack: 'error', reason: 'setup' })

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl() }),
  })
  const data = await res.json().catch(() => ({ ok: false, error: 'bad_response' }))
  if (!data.ok || !data.access_token) {
    console.error('slack oauth', data.error)
    return back(state.return_origin, { slack: 'error', reason: 'slack' })
  }
  const token = String(data.access_token)
  const info = await slackApi(token, 'team.info', {})
  const team = {
    team_id: data.team?.id,
    team_name: info.team?.name ?? data.team?.name,
    team_domain: info.team?.domain ?? null,
    team_icon: info.team?.icon?.image_88 ?? info.team?.icon?.image_68 ?? null,
    bot_user_id: data.bot_user_id,
    app_id: data.app_id,
    scopes: String(data.scope ?? '').split(',').filter(Boolean),
  }
  const db = admin()
  // The person must still be an admin of the workspace they started from.
  const { data: member } = await db
    .from('members')
    .select('user_type, system_role')
    .eq('tenant_id', state.tenant_id)
    .eq('user_id', state.user_id)
    .eq('user_status', 'active')
    .maybeSingle()
  const isAdmin = member && (member.system_role === 'admin' || ['workspace_owner', 'platform_admin'].includes(member.user_type ?? ''))
  if (!isAdmin) {
    await slackApi(token, 'auth.revoke', {})
    return back(state.return_origin, { slack: 'error', reason: 'admin' })
  }
  const { error } = await db.rpc('slack_connection_save', {
    _tenant: state.tenant_id, _user: state.user_id, _team: team, _token: token,
  })
  if (error) {
    console.error('slack save', error.message)
    return back(state.return_origin, { slack: 'error', reason: 'save' })
  }
  return back(state.return_origin, { slack: 'connected' })
}

async function directory(token: string) {
  const channels: Array<{ id: string; name: string; is_private: boolean; is_member: boolean }> = []
  let cursor: string | undefined
  for (let i = 0; i < 5; i++) {
    const r = await slackApi(token, 'conversations.list', {
      types: 'public_channel,private_channel', exclude_archived: 'true', limit: '1000', cursor,
    })
    if (!r.ok) return { error: r.error }
    for (const c of r.channels ?? []) {
      channels.push({ id: c.id, name: c.name, is_private: !!c.is_private, is_member: !!c.is_member })
    }
    cursor = r.response_metadata?.next_cursor || undefined
    if (!cursor) break
  }
  const users: Array<{ id: string; name: string; handle: string; title: string | null; avatar: string | null }> = []
  cursor = undefined
  for (let i = 0; i < 5; i++) {
    const r = await slackApi(token, 'users.list', { limit: '500', cursor })
    if (!r.ok) return { error: r.error }
    for (const u of r.members ?? []) {
      if (u.deleted || u.is_bot || u.id === 'USLACKBOT') continue
      users.push({
        id: u.id,
        name: u.profile?.real_name || u.real_name || u.name,
        handle: u.profile?.display_name || u.name,
        title: u.profile?.title || null,
        avatar: u.profile?.image_48 || null,
      })
    }
    cursor = r.response_metadata?.next_cursor || undefined
    if (!cursor) break
  }
  channels.sort((a, b) => a.name.localeCompare(b.name))
  users.sort((a, b) => a.name.localeCompare(b.name))
  return { channels, users }
}

serve(withRequestCors(async (req) => {
  const pre = handleSecureCorsPreFlight(req)
  if (pre) return pre
  if (req.method === 'GET') return callback(req)
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const user = asUser(req)
  const { data: auth } = await user.auth.getUser()
  if (!auth?.user) return json(401, { error: 'Sign in again.' })
  const body = await req.json().catch(() => ({}))
  const action = String(body.action ?? '')
  const tenantId = String(body.tenant_id ?? '')
  if (!UUID_RE.test(tenantId)) return json(400, { error: 'Missing workspace.' })

  const { data: status, error: statusError } = await user.rpc('slack_status', { _tenant: tenantId })
  if (statusError || !status) return json(403, { error: dbMessage(statusError, "You can't see this workspace's Slack.") })

  const db = admin()

  if (action === 'start') {
    if (!status.is_admin) return json(403, { error: 'Only admins connect Slack.' })
    const clientId = Deno.env.get('SLACK_CLIENT_ID')
    if (!clientId) return json(503, { error: "Slack isn't set up for Gio yet. Ask Allan to add the Slack app keys." })
    const origin = String(body.return_origin ?? req.headers.get('Origin') ?? APP_URL)
    const state = await sealState({
      tenant_id: tenantId,
      user_id: auth.user.id,
      return_origin: isAllowedOrigin(origin).allowed ? origin : APP_URL,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    })
    const u = new URL('https://slack.com/oauth/v2/authorize')
    u.searchParams.set('client_id', clientId)
    u.searchParams.set('scope', SLACK_SCOPES.join(','))
    u.searchParams.set('redirect_uri', callbackUrl())
    u.searchParams.set('state', state)
    return json(200, { url: u.toString() })
  }

  if (!status.connected) return json(409, { error: 'Connect Slack first.' })
  const { data: conn } = await db.rpc('slack_connection_token', { _tenant: tenantId })
  const token = conn?.token as string | undefined
  if (!token) return json(409, { error: 'Connect Slack first.' })

  if (action === 'directory') {
    if (!status.is_admin && !status.can_edit_jobs) return json(403, { error: 'Only admins and Recruiters set up Slack automations.' })
    const dir = await directory(token)
    if ('error' in dir) {
      if (AUTH_GONE.has(String(dir.error))) await db.rpc('slack_connection_broken', { _tenant: tenantId, _detail: String(dir.error) })
      return json(502, { error: "Slack didn't send the list. Try again.", code: dir.error })
    }
    return json(200, dir)
  }

  if (action === 'test') {
    const jobId = body.job_id && UUID_RE.test(String(body.job_id)) ? String(body.job_id) : null
    const event = String(body.event ?? '')
    const { error: checkError } = await user.rpc('slack_check_edit', { _tenant: tenantId, _job: jobId, _event: event })
    if (checkError) return json(403, { error: dbMessage(checkError, "You can't send this.") })
    const message = String(body.message ?? '').slice(0, 3000)
    const destinations = (Array.isArray(body.destinations) ? body.destinations : []).slice(0, 10) as Destination[]
    if (!message.trim() || destinations.length === 0) return json(400, { error: 'Write a message and pick where it goes.' })

    // Example details: the real job when there is one, example people otherwise.
    const { data: me } = await db.rpc('slack_person', { _user: auth.user.id })
    const meP = (me as { name: string; email: string } | null) ?? { name: 'You', email: auth.user.email ?? null }
    let job: MessageContext['job'] = { id: '', title: 'Senior Account Executive', client: 'Acme', department: 'Sales' }
    if (jobId) {
      const { data: j } = await db.from('jobs').select('id, title, organizations(name), departments(name)').eq('id', jobId).maybeSingle()
      // deno-lint-ignore no-explicit-any
      const jj = j as any
      if (jj) job = { id: jj.id, title: jj.title, client: jj.organizations?.name ?? null, department: jj.departments?.name ?? null }
    }
    const ctx: MessageContext = {
      event,
      candidate: { id: '', name: 'Ana Example' },
      job,
      stage: 'Hiring manager interview',
      from_stage: 'Recruiter screen',
      actor: meP,
      recruiters: [meP],
      sourcers: [{ name: 'Sam Example' }],
      hiring_managers: [{ name: 'Jordan Example' }],
      interviewer: meP,
      interview_start: new Date(Date.now() + 86400000).toISOString(),
      rating: 'strong_yes',
      reason: 'Not enough experience',
      opening: 'REQ-0001',
      approvers: [meP],
      approval_step: 'Step 1 of 2',
      waiting: '2 days',
      member: meP,
      missing: ['birthday', 'tax', 'bank'],
      progress: '3 of 7 done',
    }
    // People messages are about a team member, not a job: they open their profile.
    if (event.startsWith('member.')) Object.assign(ctx, { job: null, candidate: null, link: '/me' })
    let testTo: string | null = null
    if (meP.email) {
      const r = await slackApi(token, 'users.lookupByEmail', { email: meP.email })
      testTo = r.ok ? r.user?.id ?? null : null
    }
    const results = await deliver(token, message, destinations, ctx, { test: true, testTo })
    if (results.some((r) => AUTH_GONE.has(String(r.error)))) {
      await db.rpc('slack_connection_broken', { _tenant: tenantId, _detail: 'token_revoked' })
    }
    return json(200, { results })
  }

  if (action === 'disconnect') {
    if (!status.is_admin) return json(403, { error: 'Only admins disconnect Slack.' })
    await slackApi(token, 'auth.revoke', {}).catch(() => null)
    const { error } = await db.rpc('slack_connection_remove', { _tenant: tenantId, _user: auth.user.id })
    if (error) return json(500, { error: "Couldn't disconnect Slack. Try again." })
    return json(200, { ok: true })
  }

  return json(400, { error: 'Unknown action.' })
}))
