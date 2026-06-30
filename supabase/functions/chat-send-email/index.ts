// chat-send-email — Phase 5.1
// Recruiter → candidate outbound email channel for chat.
//
// Flow:
// 1. Authenticate recruiter (JWT).
// 2. Load thread, candidate email, recruiter mail identity (if any).
// 3. Insert chat_messages row (direction=out, sender_type=recruiter).
// 4. Render HTML with open-tracking pixel referencing the new message id.
// 5. Send via the recruiter's connected mail identity if available,
//    otherwise fall back to system noreply (Resend, GoGio <noreply@app.gogio.io>).
// 6. Update the message row with the external provider id and stamp thread.
//
// Open receipts are written by the separate chat-email-pixel function.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeadersFor, handlePreflight } from '../_shared/cors.ts'
import { renderChatEmailHtml } from '../_shared/chatEmailRender.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const PUBLIC_BASE = (Deno.env.get('PUBLIC_APP_URL') || 'https://app.gogio.io').replace(/\/$/, '')
const PIXEL_BASE = `${SUPABASE_URL}/functions/v1/chat-email-pixel`
const SYSTEM_FROM = Deno.env.get('EMAIL_DEFAULT_FROM') || 'GoGio <noreply@app.gogio.io>'

Deno.serve(async (req) => {
  const pre = handlePreflight(req)
  if (pre) return pre
  const origin = req.headers.get('origin') ?? undefined
  const cors = corsHeadersFor(origin)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  // Auth
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'unauthorized' })

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userRes, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userRes?.user) return json(401, { error: 'unauthorized' })
  const userId = userRes.user.id

  let payload: { threadId?: string; body?: string; subject?: string } = {}
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: 'invalid_json' })
  }
  const threadId = (payload.threadId ?? '').trim()
  const body = (payload.body ?? '').trim()
  if (!threadId || !body) return json(400, { error: 'missing_fields' })
  if (body.length > 8000) return json(413, { error: 'body_too_large' })

  const svc = createClient(SUPABASE_URL, SERVICE_KEY)

  // Load thread + candidate + job + tenant
  const { data: thread, error: tErr } = await svc
    .from('chat_threads')
    .select(
      'id, tenant_id, job_id, candidate_id, channel, status, email_subject, external_thread_ref, ' +
        'candidate:candidates(id, first_name, email), ' +
        'job:jobs(id, title), ' +
        'tenant:tenants(id, name, chat_paused)',
    )
    .eq('id', threadId)
    .maybeSingle()
  if (tErr || !thread) return json(404, { error: 'thread_not_found' })
  if ((thread as any).tenant?.chat_paused) return json(423, { error: 'chat_paused' })
  if (thread.status === 'closed') return json(409, { error: 'thread_closed' })

  // Recruiter ACL — re-check via RLS-aware client
  const { data: aclRow, error: aclErr } = await userClient
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .maybeSingle()
  if (aclErr || !aclRow) return json(403, { error: 'forbidden' })

  const candidateEmail = (thread as any).candidate?.email
  if (!candidateEmail) return json(422, { error: 'candidate_missing_email' })

  const jobTitle = (thread as any).job?.title ?? null
  const companyName = (thread as any).tenant?.name ?? null
  const subject =
    payload.subject?.trim() ||
    thread.email_subject ||
    (jobTitle ? `Re: ${jobTitle}` : `Message from ${companyName ?? 'the hiring team'}`)

  // 1) Insert message row first so we have a stable id for the pixel
  const { data: msg, error: insErr } = await svc
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      tenant_id: thread.tenant_id,
      direction: 'out',
      sender_type: 'recruiter',
      sender_user_id: userId,
      body,
    })
    .select('id, created_at')
    .single()
  if (insErr || !msg) {
    console.error('chat-send-email insert failed', insErr)
    return json(500, { error: 'message_insert_failed' })
  }

  const pixelUrl = `${PIXEL_BASE}?m=${msg.id}`
  const html = renderChatEmailHtml({
    recipientFirstName: (thread as any).candidate?.first_name ?? null,
    companyName,
    jobTitle,
    bodyText: body,
    pixelUrl,
  })

  // 2) Pick sender: connected Gmail identity if active, else system noreply
  const { data: identity } = await svc
    .from('user_mail_identities')
    .select('id, provider, email_address, display_name, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let externalId: string | null = null
  let sendError: string | null = null

  try {
    if (identity?.email_address) {
      // Delegate to existing send-user-email function so OAuth refresh + email_logs are reused
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-user-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from_email: identity.email_address,
          to: [candidateEmail],
          subject,
          body_html: html,
          candidate_id: thread.candidate_id,
          job_id: thread.job_id,
        }),
      })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(j?.error || `mail_identity_send_failed (${resp.status})`)
      externalId = j?.message_id ?? null
    } else {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (!resendKey) throw new Error('no_mail_identity_and_no_resend_key')
      const { Resend } = await import('npm:resend@2.0.0')
      const resend = new Resend(resendKey)
      const r = await resend.emails.send({
        from: SYSTEM_FROM,
        to: [candidateEmail],
        subject,
        html,
      })
      if ((r as any)?.error) throw new Error((r as any).error?.message || 'resend_failed')
      externalId = (r as any)?.data?.id ?? null
    }
  } catch (e) {
    sendError = e instanceof Error ? e.message : String(e)
    console.error('chat-send-email provider error', sendError)
  }

  // 3) Update message + thread metadata
  if (externalId || subject) {
    await svc
      .from('chat_messages')
      .update({ external_message_id: externalId })
      .eq('id', msg.id)
  }
  if (!thread.email_subject) {
    await svc.from('chat_threads').update({ email_subject: subject }).eq('id', threadId)
  }

  if (sendError) {
    // Stamp redacted_at so recruiter UI can flag failure if desired (best-effort).
    await svc
      .from('chat_messages')
      .update({ redacted_at: new Date().toISOString() })
      .eq('id', msg.id)
    return json(502, { error: 'send_failed', detail: sendError, message_id: msg.id })
  }

  // Audit (best-effort)
  await svc.from('chat_audit_log').insert({
    tenant_id: thread.tenant_id,
    actor_id: userId,
    thread_id: threadId,
    event: 'email_sent',
    metadata: {
      external_message_id: externalId,
      via: identity?.email_address ? 'mail_identity' : 'system_noreply',
      subject,
    },
  })

  return json(200, { ok: true, message_id: msg.id, external_message_id: externalId, subject })
})
