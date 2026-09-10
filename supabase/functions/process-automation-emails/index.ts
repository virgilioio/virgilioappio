// Stage automation worker.
//
// Runs every minute (pg_cron). Two jobs:
//   1. Sweep time-based triggers ('idle', 'noreply', 'completed') and create runs.
//   2. Execute due `stage_automation_runs` rows, re-checking guardrails first.
//
// Pipeline events (enter/exit/replied/scheduled/scorecard/allscorecards/rejected)
// create run rows from database triggers; this worker only executes them.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeadersFor, handlePreflight } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Run = {
  id: string;
  automation_id: string;
  candidate_id: string;
  association_id: string | null;
  step: number;
  status: string;
  scheduled_for: string | null;
  created_at: string;
};

type Automation = {
  id: string;
  job_id: string | null;
  job_hiring_stage_id: string;
  name: string;
  action: string;
  trigger: string;
  trigger_days: number | null;
  timing: string;
  delay_amount: number | null;
  delay_unit: string | null;
  send_at: string | null;
  config: Record<string, any>;
  skip_if_replied: boolean;
  once_per_candidate: boolean;
  is_active: boolean;
  created_by: string | null;
};

const BUSINESS_START = 8;  // 08:00
const BUSINESS_END = 19;   // 19:00

// ───────────────────────── Business hours ─────────────────────────

function partsInZone(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
  return { weekday, hour: Number(map.hour) % 24, minute: Number(map.minute) };
}

/** Roll a date forward to the next moment inside Mon–Fri 08:00–19:00 in `tz`. */
function rollToBusinessHours(date: Date, tz: string): Date {
  let d = new Date(date);
  for (let i = 0; i < 14; i++) {
    const { weekday, hour } = partsInZone(d, tz);
    const isWeekend = weekday === 0 || weekday === 6;
    if (!isWeekend && hour >= BUSINESS_START && hour < BUSINESS_END) return d;
    // Move to next day's 08:00 local (or today's 08:00 if before opening)
    if (!isWeekend && hour < BUSINESS_START) {
      d = new Date(d.getTime() + (BUSINESS_START - hour) * 3600_000);
      const { minute } = partsInZone(d, tz);
      d = new Date(d.getTime() - minute * 60_000);
      continue;
    }
    // After close or weekend: jump ~ (24 - hour + 8) hours ahead, then normalize minutes
    d = new Date(d.getTime() + ((24 - hour) + BUSINESS_START) * 3600_000);
    const { minute } = partsInZone(d, tz);
    d = new Date(d.getTime() - minute * 60_000);
  }
  return d;
}

function isInsideBusinessHours(date: Date, tz: string) {
  const { weekday, hour } = partsInZone(date, tz);
  return weekday !== 0 && weekday !== 6 && hour >= BUSINESS_START && hour < BUSINESS_END;
}

// ───────────────────────── Helpers ─────────────────────────

function b64(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(out);
}

function stripHtml(html: string) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ───────────────────────── Main ─────────────────────────

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get('Origin') ?? undefined;

  // Internal auth: accept the internal secret OR the service-role bearer (pg_cron).
  const expectedSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const gotSecret = req.headers.get('x-internal-secret');
  const auth = req.headers.get('Authorization') || '';
  const authorized = (!!expectedSecret && gotSecret === expectedSecret) || auth.includes(supabaseServiceKey);
  if (!authorized) {
    // Never log the secret itself — just enough to see that a caller was rejected.
    console.warn(`[auth-gate] Unauthorized call. secretConfigured=${!!expectedSecret} secretHeaderPresent=${!!gotSecret} bearerPresent=${!!auth}`);
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const summary = { swept: 0, executed: 0, skipped: 0, cancelled: 0, failed: 0, deferred: 0 };

  try {
    // ── 1. Sweep time-based triggers ─────────────────────────────
    const { data: timeAutos } = await supabase
      .from('stage_automations')
      .select('*')
      .eq('is_active', true)
      .in('trigger', ['idle', 'noreply', 'completed']);

    for (const auto of (timeAutos || []) as Automation[]) {
      try {
        summary.swept += await sweepAutomation(supabase, auto, now);
      } catch (e) {
        console.error('[sweep] failed for automation', auto.id, e);
      }
    }

    // ── 2. Execute due runs ──────────────────────────────────────
    const { data: due, error } = await supabase
      .from('stage_automation_runs')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50);
    if (error) throw error;

    for (const run of (due || []) as Run[]) {
      const outcome = await executeRun(supabase, run, now);
      summary[outcome] = (summary[outcome] || 0) + 1;
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[automation worker] fatal', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' },
    });
  }
});

// ───────────────────────── Sweep ─────────────────────────

async function sweepAutomation(supabase: any, auto: Automation, now: Date): Promise<number> {
  const days = Math.max(1, auto.trigger_days || 3);
  const cutoff = new Date(now.getTime() - days * 86400_000).toISOString();
  let candidates: { id: string; candidate_id: string }[] = [];

  if (auto.trigger === 'idle') {
    const { data } = await supabase
      .from('job_candidate_associations')
      .select('id, candidate_id')
      .eq('current_stage_id', auto.job_hiring_stage_id)
      .eq('status', 'active')
      .lte('entered_stage_at', cutoff);
    candidates = data || [];
  } else if (auto.trigger === 'noreply') {
    const { data: assocs } = await supabase
      .from('job_candidate_associations')
      .select('id, candidate_id, job_id')
      .eq('current_stage_id', auto.job_hiring_stage_id)
      .eq('status', 'active');
    for (const a of assocs || []) {
      const { data: lastOut } = await supabase
        .from('email_logs')
        .select('sent_at, created_at')
        .eq('candidate_id', a.candidate_id).eq('job_id', a.job_id).eq('direction', 'sent')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!lastOut) continue;
      const sentAt = lastOut.sent_at || lastOut.created_at;
      if (sentAt > cutoff) continue;
      const { count } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', a.candidate_id).eq('direction', 'received').gte('created_at', sentAt);
      if ((count || 0) === 0) candidates.push({ id: a.id, candidate_id: a.candidate_id });
    }
  } else if (auto.trigger === 'completed') {
    const { data: bookings } = await supabase
      .from('scheduled_bookings')
      .select('job_candidate_association_id, candidate_id')
      .eq('job_hiring_stage_id', auto.job_hiring_stage_id)
      .neq('status', 'cancelled')
      .lt('scheduled_end', now.toISOString())
      .gte('scheduled_end', new Date(now.getTime() - 3 * 86400_000).toISOString());
    const seen = new Set<string>();
    for (const b of bookings || []) {
      if (!b.job_candidate_association_id || seen.has(b.job_candidate_association_id)) continue;
      seen.add(b.job_candidate_association_id);
      const { data: a } = await supabase.from('job_candidate_associations')
        .select('id, candidate_id, status, current_stage_id').eq('id', b.job_candidate_association_id).maybeSingle();
      if (a && a.status === 'active' && a.current_stage_id === auto.job_hiring_stage_id) candidates.push({ id: a.id, candidate_id: a.candidate_id });
    }
  }

  let created = 0;
  for (const c of candidates) {
    // Only ever create one run per candidate for a swept trigger
    const { count } = await supabase
      .from('stage_automation_runs')
      .select('id', { count: 'exact', head: true })
      .eq('automation_id', auto.id).eq('candidate_id', c.candidate_id);
    if ((count || 0) > 0) continue;
    const { data: n } = await supabase.rpc('enqueue_stage_automation_runs', {
      p_association_id: c.id, p_jhs_id: auto.job_hiring_stage_id, p_trigger: auto.trigger,
    });
    created += Number(n || 0);
  }
  return created;
}

// ───────────────────────── Execute ─────────────────────────

type Outcome = 'executed' | 'skipped' | 'cancelled' | 'failed' | 'deferred';

async function finish(supabase: any, run: Run, status: string, reason?: string) {
  await supabase.from('stage_automation_runs')
    .update({ status, reason: reason ?? null, executed_at: new Date().toISOString() })
    .eq('id', run.id);
}

async function executeRun(supabase: any, run: Run, now: Date): Promise<Outcome> {
  const { data: auto } = await supabase.from('stage_automations').select('*').eq('id', run.automation_id).maybeSingle();
  if (!auto) { await finish(supabase, run, 'cancelled', 'automation deleted'); return 'cancelled'; }
  if (!auto.is_active) { await finish(supabase, run, 'cancelled', 'automation paused'); return 'cancelled'; }

  const { data: assoc } = await supabase
    .from('job_candidate_associations')
    .select('id, job_id, candidate_id, current_stage_id, status, entered_stage_at, candidates(id, candidate_name, email, phone, location_city, location_state, location_country), jobs(id, title, department, location, organization_id, tenant_id, created_by, status, salary_min, salary_max, currency)')
    .eq('id', run.association_id)
    .maybeSingle();
  if (!assoc) { await finish(supabase, run, 'cancelled', 'candidate no longer on this job'); return 'cancelled'; }

  const candidate = assoc.candidates;
  const job = assoc.jobs;

  // ── Guardrails (checked at execution, not only at scheduling) ──
  if (assoc.status === 'hired') { await finish(supabase, run, 'cancelled', 'candidate was hired'); return 'cancelled'; }
  if (assoc.status === 'rejected' && auto.trigger !== 'rejected') { await finish(supabase, run, 'cancelled', 'candidate was rejected'); return 'cancelled'; }
  if (auto.trigger !== 'exit' && auto.trigger !== 'rejected' && assoc.current_stage_id !== auto.job_hiring_stage_id) {
    await finish(supabase, run, 'cancelled', 'candidate left the stage'); return 'cancelled';
  }
  if (job?.status && job.status !== 'open' && auto.trigger !== 'rejected') {
    await finish(supabase, run, 'cancelled', 'job is not open'); return 'cancelled';
  }
  if (auto.skip_if_replied && auto.trigger !== 'replied') {
    const { count } = await supabase.from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', assoc.candidate_id).eq('direction', 'received').gte('created_at', run.created_at);
    if ((count || 0) > 0) { await finish(supabase, run, 'skipped', 'candidate replied'); return 'skipped'; }
  }
  if (auto.once_per_candidate) {
    const { count } = await supabase.from('stage_automation_runs')
      .select('id', { count: 'exact', head: true })
      .eq('automation_id', auto.id).eq('candidate_id', run.candidate_id).eq('step', run.step).eq('status', 'sent').neq('id', run.id);
    if ((count || 0) > 0) { await finish(supabase, run, 'skipped', 'already ran for this candidate'); return 'skipped'; }
  }

  // ── Business hours for anything that isn't immediate ──
  const tz = await resolveTimezone(supabase, job);
  const isDelayed = auto.timing !== 'immediate' || run.step > 1;
  if (isDelayed && !isInsideBusinessHours(now, tz)) {
    const next = rollToBusinessHours(now, tz);
    await supabase.from('stage_automation_runs').update({ scheduled_for: next.toISOString() }).eq('id', run.id);
    return 'deferred';
  }

  const ctx = { auto: auto as Automation, run, assoc, candidate, job, tz };
  try {
    const result = await performAction(supabase, ctx);
    if (result.status === 'skipped') { await finish(supabase, run, 'skipped', result.reason); return 'skipped'; }
    await finish(supabase, run, 'sent');
    if (auto.action !== 'email' && auto.action !== 'sequence') {
      await logAutomationActivity(supabase, ctx, result.title || `${auto.name} ran`, result.description);
    }
    return 'executed';
  } catch (e) {
    console.error('[execute] failed', run.id, e);
    await finish(supabase, run, 'failed', (e as Error).message?.slice(0, 500) || 'unknown error');
    return 'failed';
  }
}

async function resolveTimezone(supabase: any, job: any): Promise<string> {
  if (job?.created_by) {
    const { data } = await supabase.from('booking_configurations').select('timezone')
      .eq('user_id', job.created_by).eq('is_active', true).limit(1).maybeSingle();
    if (data?.timezone) return data.timezone;
  }
  return 'America/New_York';
}

// ───────────────────────── Actions ─────────────────────────

type Ctx = { auto: Automation; run: Run; assoc: any; candidate: any; job: any; tz: string };
type ActionResult = { status: 'sent' | 'skipped'; reason?: string; title?: string; description?: string };

async function performAction(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const { auto } = ctx;
  switch (auto.action) {
    case 'email':
    case 'sequence': return sendAutomationEmail(supabase, ctx);
    case 'notify': return notifyTeam(supabase, ctx);
    case 'task': return createTask(supabase, ctx);
    case 'scorecard': return requestScorecard(supabase, ctx);
    case 'assign': return assignReviewer(supabase, ctx);
    case 'move': return moveStage(supabase, ctx);
    case 'reject': return rejectCandidate(supabase, ctx);
    case 'tag': return addTag(supabase, ctx);
    case 'pool': return addToPool(supabase, ctx);
    case 'webhook': return callWebhook(ctx);
    default:
      throw new Error(`"${auto.action}" isn't available yet`);
  }
}

async function sendAutomationEmail(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const { auto, run, assoc, candidate } = ctx;
  const cfg = auto.config || {};
  const emails: any[] = Array.isArray(cfg.emails) ? cfg.emails : [];
  const email = emails[run.step - 1] || emails[0];
  if (!email) throw new Error('No email content configured');
  if (!candidate?.email) throw new Error('Candidate has no email address');
  if (!cfg.from) throw new Error('No sender configured');

  // Attachments stored as references in the automation bucket
  const attachments: { filename: string; content: string; content_type: string }[] = [];
  for (const ref of (email.attachments || []) as any[]) {
    if (!ref?.file_id) continue;
    const { data: blob, error } = await supabase.storage.from('automation-attachments').download(ref.file_id);
    if (error || !blob) throw new Error(`Attachment "${ref.name}" could not be loaded`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    attachments.push({ filename: ref.name || 'attachment', content: b64(bytes), content_type: ref.content_type || blob.type || 'application/octet-stream' });
  }

  const subject = String(email.subject || '').replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
  const bodyHtml = String(email.body_html || '');
  const stepLabel = auto.action === 'sequence' ? `Email ${run.step} of ${emails.length}` : null;

  const { error } = await supabase.functions.invoke('send-user-email', {
    body: {
      from_email: cfg.from,
      to: [candidate.email],
      cc: Array.isArray(cfg.cc) && cfg.cc.length ? cfg.cc : undefined,
      bcc: Array.isArray(cfg.bcc) && cfg.bcc.length ? cfg.bcc : undefined,
      subject,
      body_html: bodyHtml,
      body_text: stripHtml(bodyHtml),
      attachments: attachments.length ? attachments : undefined,
      candidate_id: candidate.id,
      job_id: assoc.job_id,
      jhs_id: auto.job_hiring_stage_id,
      association_id: assoc.id,
      automation: { name: auto.name, step: stepLabel, trigger: auto.trigger },
    },
    headers: { Authorization: `Bearer ${supabaseServiceKey}` },
  });
  if (error) {
    let detail = error.message;
    try { const body = await (error as any).context?.json?.(); if (body?.error) detail = body.error; } catch { /* noop */ }
    throw new Error(detail);
  }
  return { status: 'sent' };
}

async function recipientsForNotify(supabase: any, ctx: Ctx): Promise<string[]> {
  const cfg = ctx.auto.config || {};
  const list: string[] = Array.isArray(cfg.recipients) ? cfg.recipients : [];
  const ids = new Set<string>();
  for (const r of list) {
    if (r === 'hiring_team' || r === 'recruiters' || r === 'interviewers' || r === 'hiring_managers') {
      let q = supabase.from('job_assignments').select('user_id').eq('job_id', ctx.assoc.job_id).is('deleted_at', null);
      if (r === 'recruiters') q = q.eq('role', 'recruiter');
      if (r === 'interviewers') q = q.eq('role', 'interviewer');
      if (r === 'hiring_managers') q = q.eq('role', 'hiring_manager');
      const { data } = await q;
      for (const row of data || []) if (row.user_id) ids.add(row.user_id);
    } else if (r === 'job_owner') {
      if (ctx.job?.created_by) ids.add(ctx.job.created_by);
    } else if (/^[0-9a-f-]{36}$/i.test(r)) {
      ids.add(r);
    }
  }
  return Array.from(ids);
}

function renderMessage(template: string, ctx: Ctx) {
  const stageLink = `/jobs/${ctx.assoc.job_id}/candidates/${ctx.candidate?.id}`;
  const data: Record<string, string> = {
    'candidate.name': ctx.candidate?.candidate_name || '', 'candidate.full_name': ctx.candidate?.candidate_name || '',
    'candidate.first_name': (ctx.candidate?.candidate_name || '').split(' ')[0] || '',
    'job.title': ctx.job?.title || '', 'link': stageLink,
  };
  return (template || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, k) => data[k] ?? '');
}

async function notifyTeam(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const cfg = ctx.auto.config || {};
  const userIds = await recipientsForNotify(supabase, ctx);
  if (userIds.length === 0) return { status: 'skipped', reason: 'nobody to notify' };
  const message = renderMessage(cfg.message || `${ctx.candidate?.candidate_name || 'A candidate'} · ${ctx.auto.name}`, ctx);
  const actionUrl = `/jobs/${ctx.assoc.job_id}/candidates/${ctx.candidate?.id}`;
  for (const uid of userIds) {
    await supabase.rpc('emit_notification', {
      _user_id: uid, _tenant_id: ctx.job?.tenant_id, _category: 'mention',
      _actor_user_id: null, _actor_name: 'Gio automation', _actor_avatar_url: null,
      _title: ctx.auto.name, _subtitle: ctx.job?.title || null, _preview: message,
      _entity_kind: 'candidate', _entity_id: ctx.candidate?.id, _job_id: ctx.assoc.job_id, _candidate_id: ctx.candidate?.id,
      _action_url: actionUrl, _metadata: { automation_id: ctx.auto.id, automated: true },
    });
  }
  return { status: 'sent', title: `Notified ${userIds.length} team member${userIds.length === 1 ? '' : 's'}`, description: message };
}

async function createTask(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const cfg = ctx.auto.config || {};
  let assignee: string | null = cfg.assignee && /^[0-9a-f-]{36}$/i.test(cfg.assignee) ? cfg.assignee : null;
  if (!assignee || cfg.assignee === 'job_owner') assignee = ctx.job?.created_by || ctx.auto.created_by;
  if (!assignee) return { status: 'skipped', reason: 'no assignee available' };
  const dueDays = Number(cfg.due_offset_days ?? 1);
  const due = rollToBusinessHours(new Date(Date.now() + dueDays * 86400_000), ctx.tz);
  const subject = renderMessage(cfg.message || `${ctx.auto.name} · {{candidate.name}}`, ctx).slice(0, 200);
  const { error } = await supabase.from('candidate_reminders').insert({
    candidate_id: ctx.candidate?.id, job_id: ctx.assoc.job_id, created_by: assignee,
    organization_id: ctx.job?.organization_id, tenant_id: ctx.job?.tenant_id,
    subject, description: `Created automatically by "${ctx.auto.name}".`, due_at: due.toISOString(), is_team_visible: true,
  });
  if (error) throw error;
  return { status: 'sent', title: 'Task created', description: subject };
}

async function requestScorecard(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const { data, error } = await supabase.functions.invoke('request-scorecard', {
    body: { association_id: ctx.assoc.id, job_hiring_stage_id: ctx.auto.job_hiring_stage_id },
    headers: { Authorization: `Bearer ${supabaseServiceKey}` },
  });
  if (error) throw new Error(error.message);
  if (data && data.ok === false) return { status: 'skipped', reason: data.error || 'no interviewers to ask' };
  return { status: 'sent', title: 'Scorecards requested from the stage interviewers' };
}

async function assignReviewer(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const cfg = ctx.auto.config || {};
  const userId = cfg.assignee;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return { status: 'skipped', reason: 'no reviewer selected' };
  const { data: existing } = await supabase.from('job_assignments').select('id')
    .eq('job_id', ctx.assoc.job_id).eq('user_id', userId).is('deleted_at', null).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from('job_assignments').insert({
      job_id: ctx.assoc.job_id, user_id: userId, role: cfg.role || 'interviewer',
      organization_id: ctx.job?.organization_id, assigned_by: ctx.auto.created_by,
    });
    if (error) throw error;
  }
  const { data: member } = await supabase.from('members').select('id').eq('user_id', userId).maybeSingle();
  if (member) {
    await supabase.from('stage_interviewer_assignments')
      .upsert({ job_hiring_stage_id: ctx.auto.job_hiring_stage_id, member_id: member.id, assignment_type: 'interviewer' }, { onConflict: 'job_hiring_stage_id,member_id', ignoreDuplicates: true });
  }
  return { status: 'sent', title: 'Reviewer assigned to this stage' };
}

async function moveStage(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const target = ctx.auto.config?.target_stage_id;
  if (!target) return { status: 'skipped', reason: 'no destination stage' };
  if (ctx.assoc.current_stage_id === target) return { status: 'skipped', reason: 'already in that stage' };
  const { data: stage } = await supabase.from('job_hiring_stages').select('id, custom_stage_name, job_stages(stage_name)').eq('id', target).maybeSingle();
  if (!stage) return { status: 'skipped', reason: 'destination stage no longer exists' };
  const { error } = await supabase.from('job_candidate_associations')
    .update({ current_stage_id: target, entered_stage_at: new Date().toISOString() }).eq('id', ctx.assoc.id);
  if (error) throw error;
  const name = stage.custom_stage_name || stage.job_stages?.stage_name || 'next stage';
  return { status: 'sent', title: `Moved to ${name}` };
}

async function rejectCandidate(supabase: any, ctx: Ctx): Promise<ActionResult> {
  if (ctx.assoc.status === 'rejected') return { status: 'skipped', reason: 'already rejected' };
  const { error } = await supabase.from('job_candidate_associations')
    .update({ status: 'rejected', rejected_at: new Date().toISOString(), rejection_notes: `Rejected automatically by "${ctx.auto.name}".` })
    .eq('id', ctx.assoc.id);
  if (error) throw error;
  return { status: 'sent', title: 'Candidate rejected' };
}

async function addTag(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const tagId = ctx.auto.config?.tag_id;
  if (!tagId) return { status: 'skipped', reason: 'no tag selected' };
  const { data: tag } = await supabase.from('tags').select('id, name, tenant_id').eq('id', tagId).maybeSingle();
  if (!tag) return { status: 'skipped', reason: 'tag no longer exists' };
  const { error } = await supabase.from('candidate_tags')
    .upsert({ candidate_id: ctx.candidate.id, tag_id: tagId, tenant_id: tag.tenant_id, tagged_by: ctx.auto.created_by }, { onConflict: 'candidate_id,tag_id', ignoreDuplicates: true });
  if (error) throw error;
  return { status: 'sent', title: `Tagged "${tag.name}"` };
}

async function addToPool(supabase: any, ctx: Ctx): Promise<ActionResult> {
  const poolId = ctx.auto.config?.pool_id;
  if (!poolId) return { status: 'skipped', reason: 'no talent pool selected' };
  const { data: pool } = await supabase.from('candidate_lists').select('id, name').eq('id', poolId).maybeSingle();
  if (!pool) return { status: 'skipped', reason: 'talent pool no longer exists' };
  const { data: existing } = await supabase.from('candidate_list_items').select('id').eq('list_id', poolId).eq('candidate_id', ctx.candidate.id).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from('candidate_list_items').insert({ list_id: poolId, candidate_id: ctx.candidate.id, added_by: ctx.auto.created_by });
    if (error) throw error;
  }
  return { status: 'sent', title: `Added to "${pool.name}"` };
}

async function callWebhook(ctx: Ctx): Promise<ActionResult> {
  const cfg = ctx.auto.config || {};
  if (!cfg.url || !/^https:\/\//i.test(cfg.url)) return { status: 'skipped', reason: 'webhook URL must start with https://' };
  const payload = JSON.stringify({
    event: `automation.${ctx.auto.trigger}`, automation: { id: ctx.auto.id, name: ctx.auto.name },
    job: { id: ctx.assoc.job_id, title: ctx.job?.title }, stage_id: ctx.auto.job_hiring_stage_id,
    candidate: { id: ctx.candidate?.id, name: ctx.candidate?.candidate_name, email: ctx.candidate?.email },
    sent_at: new Date().toISOString(),
  });
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Gio-Automations/1.0' };
  if (cfg.secret) headers['X-Gio-Signature'] = await hmacHex(cfg.secret, payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(cfg.url, { method: 'POST', headers, body: payload, signal: controller.signal });
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
  } finally { clearTimeout(timer); }
  return { status: 'sent', title: 'Webhook called', description: cfg.url };
}

// ───────────────────────── Activity feed ─────────────────────────

async function logAutomationActivity(supabase: any, ctx: Ctx, title: string, description?: string) {
  const userId = ctx.auto.created_by || ctx.job?.created_by;
  if (!userId) return;
  const stepLabel = ctx.auto.action === 'sequence' ? `Step ${ctx.run.step}` : null;
  const { error } = await supabase.rpc('log_activity', {
    p_user_id: userId,
    p_organization_id: ctx.job?.organization_id,
    p_activity_type: 'automation_triggered',
    p_title: title,
    p_description: description || null,
    p_metadata: {
      automation: { name: ctx.auto.name, ...(stepLabel ? { step: stepLabel } : {}), trigger: ctx.auto.trigger, action: ctx.auto.action },
      automation_id: ctx.auto.id, run_id: ctx.run.id, job_id: ctx.assoc.job_id, jhs_id: ctx.auto.job_hiring_stage_id,
    },
    p_entity_type: 'candidate',
    p_entity_id: ctx.candidate?.id,
    p_tenant_id: ctx.job?.tenant_id,
  });
  if (error) console.error('[activity] failed', error);
}
