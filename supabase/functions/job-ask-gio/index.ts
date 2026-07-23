// job-ask-gio — job-scoped Q&A used by the "Ask Gio" box on Job Dashboard.
//
// Contract:
//   POST { jobId, jobTitle?, question, history?: {role, content}[] }
//   →    { answer: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handlePreflight, corsHeadersFor } from '../_shared/cors.ts';

const MODEL = 'google/gemini-2.5-flash';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const MAX_CONTEXT_CHARS = 16000;
const CONTEXT_ACTIVE_LIMIT = 60;
const CONTEXT_REJECTED_LIMIT = 30;
const CONTEXT_RECENT_LIMIT = 40;
const SCORECARDS_PER_CANDIDATE = 2;

function formatSalary(amount: number | string | null | undefined, currency?: string | null, period?: string | null): string | null {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount ?? null;
  if (!n || Number.isNaN(n)) return null;
  const cur = (currency || 'USD').toUpperCase();
  let symbol = cur;
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    const s = parts.find((p) => p.type === 'currency')?.value;
    if (s) symbol = s;
  } catch { /* ignore */ }
  const p = (period || 'year').toLowerCase();
  const suffix = p.startsWith('hour') || p === 'hr' ? 'hr'
    : p.startsWith('month') || p === 'mo' ? 'mo'
    : p.startsWith('week') || p === 'wk' ? 'wk'
    : 'yr';
  const display = n >= 1000
    ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}k`
    : `${n}`;
  return `${symbol}${display}/${suffix}`;
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

type Msg = { role: 'user' | 'assistant'; content: string };

function daysBetween(a: Date | string | null, b: Date = new Date()): number | null {
  if (!a) return null;
  const d = new Date(a);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((b.getTime() - d.getTime()) / 86400000));
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function candidateLoc(c: any): string {
  return [c?.location_city, c?.location_state, c?.location_country].filter(Boolean).join(', ');
}

function candidateName(c: any): string {
  return (c?.candidate_name ?? '').trim() || 'Unnamed candidate';
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const cors = corsHeadersFor(req.headers.get('origin') ?? undefined);

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      auth.replace('Bearer ', ''),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const jobId: string | undefined = body?.jobId;
    const question: string = String(body?.question ?? '').trim();
    const historyRaw: Msg[] = Array.isArray(body?.history) ? body.history : [];
    if (!jobId || !question) {
      return new Response(JSON.stringify({ error: 'jobId and question are required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Job row ─────────────────────────────────────────────
    const { data: job } = await supabase
      .from('jobs')
      .select(
        'id, title, department, location, work_mode, employment_type, status, job_level, salary_min, salary_max, currency, min_years_experience, max_years_experience, skills, standardized_skills, target_fill_date, created_at, description',
      )
      .eq('id', jobId)
      .maybeSingle();

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Stages + 3. Applications in parallel ────────────────
    const now = new Date();
    const cutoff14 = new Date(now.getTime() - 14 * 86400000).toISOString();

    const [stagesRes, appsRes] = await Promise.all([
      supabase
        .from('job_hiring_stages')
        .select(
          'id, position, custom_stage_name, sla_days, stage:job_stages!job_hiring_stages_stage_id_fkey(stage_name, stage_type)',
        )
        .eq('job_id', jobId)
        .order('position', { ascending: true }),
      supabase
        .from('job_candidate_associations')
        .select(
          'id, candidate_id, current_stage_id, status, created_at, entered_stage_at, rejected_at, rejection_reason_id, offered_at, hired_at',
        )
        .eq('job_id', jobId)
        .limit(500),
    ]);

    if (stagesRes.error) console.warn('[job-ask-gio] stages error', stagesRes.error);
    if (appsRes.error) console.warn('[job-ask-gio] apps error', appsRes.error);

    const stageList = (stagesRes.data ?? []) as any[];
    const appList = (appsRes.data ?? []) as any[];

    const stageLabelById = new Map<string, string>();
    for (const s of stageList) {
      stageLabelById.set(s.id, (s.custom_stage_name || s.stage?.stage_name || 'Stage').trim());
    }

    // ── 4. Candidates for referenced ids (chunked) ─────────────
    const candIds = Array.from(new Set(appList.map((a) => a.candidate_id).filter(Boolean)));
    const candidatesById = new Map<string, any>();
    for (let i = 0; i < candIds.length; i += 200) {
      const chunk = candIds.slice(i, i + 200);
      if (chunk.length === 0) break;
      const { data, error } = await supabase
        .from('candidates')
        .select(
          'id, candidate_name, email, phone, linkedin_url, current_job_title, standardized_title, company_current, role_current, seniority_level, functional_area, specialization, years_experience, years_in_specialization, years_in_leadership, location_city, location_state, location_country, source, job_board_source, salary_amount, salary_currency, salary_period, standardized_skills, skills, profile_summary, bio, coresignal_headline, created_at',
        )
        .in('id', chunk);
      if (error) {
        console.warn('[job-ask-gio] candidates chunk error', error);
        continue;
      }
      for (const c of data ?? []) candidatesById.set(c.id, c);
    }

    // ── 4b. Work experience for candidates on this job ─────────
    type WorkRow = {
      candidate_id: string;
      company_name: string;
      job_title: string | null;
      standardized_title: string | null;
      company_industry: string | null;
      company_size_category: string | null;
      is_current: boolean | null;
      start_date: string | null;
      end_date: string | null;
      duration_months: number | null;
      location: string | null;
    };
    const workByCandidate = new Map<string, WorkRow[]>();
    for (let i = 0; i < candIds.length; i += 200) {
      const chunk = candIds.slice(i, i + 200);
      if (chunk.length === 0) break;
      const { data, error } = await supabase
        .from('candidate_work_experience')
        .select(
          'candidate_id, company_name, job_title, standardized_title, company_industry, company_size_category, is_current, start_date, end_date, duration_months, location',
        )
        .in('candidate_id', chunk);
      if (error) {
        console.warn('[job-ask-gio] work_experience chunk error', error);
        continue;
      }
      for (const w of (data ?? []) as WorkRow[]) {
        const list = workByCandidate.get(w.candidate_id) ?? [];
        list.push(w);
        workByCandidate.set(w.candidate_id, list);
      }
    }
    // Sort each candidate's stints: current first, then most recent
    for (const [cid, list] of workByCandidate) {
      list.sort((a, b) => {
        if (a.is_current && !b.is_current) return -1;
        if (!a.is_current && b.is_current) return 1;
        const ae = a.end_date ? new Date(a.end_date).getTime() : 0;
        const be = b.end_date ? new Date(b.end_date).getTime() : 0;
        if (be !== ae) return be - ae;
        const as = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bs = b.start_date ? new Date(b.start_date).getTime() : 0;
        return bs - as;
      });
      workByCandidate.set(cid, list.slice(0, 6));
    }

    function shortYear(iso?: string | null): string {
      if (!iso) return '';
      const y = new Date(iso).getFullYear();
      return Number.isFinite(y) ? String(y) : '';
    }
    function renderWorkLine(candidateId: string): string | null {
      const list = workByCandidate.get(candidateId);
      if (!list || !list.length) return null;
      const shown = list.slice(0, 4);
      const overflow = Math.max(0, list.length - shown.length);
      const parts = shown.map((w) => {
        const role = (w.job_title || w.standardized_title || '').trim();
        const co = (w.company_name || '').trim();
        const head = role && co ? `${role} @ ${co}` : (co || role);
        let when = '';
        if (w.is_current) when = 'current';
        else {
          const sy = shortYear(w.start_date);
          const ey = shortYear(w.end_date);
          when = sy && ey ? `${sy}–${ey}` : (ey || sy || '');
        }
        return when ? `${head} (${when})` : head;
      }).filter(Boolean);
      if (!parts.length) return null;
      const tail = overflow > 0 ? ` · +${overflow} more` : '';
      return `    ↳ work: ${parts.join(' · ')}${tail}`;
    }

    // ── 5. Rejection reasons ───────────────────────────────────
    const rrIds = Array.from(
      new Set(appList.map((a) => a.rejection_reason_id).filter(Boolean)),
    ) as string[];
    const rrLabelById = new Map<string, string>();
    if (rrIds.length) {
      const { data } = await supabase
        .from('rejection_reasons')
        .select('id, name')
        .in('id', rrIds);
      for (const r of data ?? []) rrLabelById.set(r.id, r.name ?? 'Reason');
    }

    // ── 6. Recent activity (last 14 days) ──────────────────────
    const activityEntityIds = [jobId, ...candIds];
    let recentActivities: any[] = [];
    if (activityEntityIds.length) {
      const { data, error } = await supabase
        .from('activities')
        .select('activity_type, title, description, entity_type, entity_id, created_at')
        .in('entity_id', activityEntityIds.slice(0, 400))
        .gte('created_at', cutoff14)
        .order('created_at', { ascending: false })
        .limit(120);
      if (error) console.warn('[job-ask-gio] activities error', error);
      recentActivities = (data ?? []).filter(
        (a) =>
          a.entity_type === 'job' ||
          a.entity_type === 'candidate' ||
          a.entity_type == null,
      );
    }

    // ── Aggregations ───────────────────────────────────────────
    const statusCount: Record<string, number> = {};
    const stageCount: Record<string, number> = {};
    const rejectionCount: Record<string, number> = {};
    let activeCount = 0;
    let rejectedCount = 0;
    let offeredCount = 0;
    let hiredCount = 0;
    const daysToReject: number[] = [];

    for (const a of appList) {
      const st = a.status ?? 'unknown';
      statusCount[st] = (statusCount[st] ?? 0) + 1;
      const sid = a.current_stage_id ?? 'unassigned';
      stageCount[sid] = (stageCount[sid] ?? 0) + 1;
      if (a.rejected_at) {
        rejectedCount++;
        const label = a.rejection_reason_id
          ? rrLabelById.get(a.rejection_reason_id) ?? 'Reason'
          : 'No reason';
        rejectionCount[label] = (rejectionCount[label] ?? 0) + 1;
        const d = daysBetween(a.created_at, new Date(a.rejected_at));
        if (d != null) daysToReject.push(d);
      } else if (a.hired_at) {
        hiredCount++;
      } else if (a.offered_at) {
        offeredCount++;
        activeCount++;
      } else {
        activeCount++;
      }
    }

    // ── 7. Scorecards for this job ─────────────────────────────
    type ScorecardRow = {
      id: string;
      candidate_id: string;
      stage_instance_id: string | null;
      rating: number | null;
      general_overview: string | null;
      is_ai_draft: boolean | null;
      created_at: string;
      responses?: Array<{ question_text: string; answer_text: string | null }>;
    };
    const scorecardsByCandidate = new Map<string, ScorecardRow[]>();
    {
      const { data: scRows, error: scErr } = await supabase
        .from('job_stage_scorecards')
        .select('id, candidate_id, stage_instance_id, rating, general_overview, is_ai_draft, created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (scErr) console.warn('[job-ask-gio] scorecards error', scErr);
      const scList = (scRows ?? []) as ScorecardRow[];
      // Load responses in bulk
      const scIds = scList.map((s) => s.id);
      const respBySc = new Map<string, Array<{ question_text: string; answer_text: string | null }>>();
      if (scIds.length) {
        for (let i = 0; i < scIds.length; i += 200) {
          const chunk = scIds.slice(i, i + 200);
          const { data: qr } = await supabase
            .from('scorecard_question_responses')
            .select('scorecard_id, answer_text, question:scorecard_interview_questions!scorecard_question_responses_question_id_fkey(question_text)')
            .in('scorecard_id', chunk);
          for (const r of (qr ?? []) as any[]) {
            const qtxt = r.question?.question_text ?? '';
            if (!r.answer_text) continue;
            const list = respBySc.get(r.scorecard_id) ?? [];
            list.push({ question_text: qtxt, answer_text: r.answer_text });
            respBySc.set(r.scorecard_id, list);
          }
        }
      }
      for (const s of scList) {
        s.responses = respBySc.get(s.id) ?? [];
        const list = scorecardsByCandidate.get(s.candidate_id) ?? [];
        list.push(s);
        scorecardsByCandidate.set(s.candidate_id, list);
      }
    }


    // ── Build context sections ────────────────────────────────
    const lines: string[] = [];

    // JOB
    const salary =
      job.salary_min || job.salary_max
        ? `${job.salary_min ?? '?'}–${job.salary_max ?? '?'} ${job.currency ?? ''}`.trim()
        : '';
    const exp =
      job.min_years_experience != null || job.max_years_experience != null
        ? `${job.min_years_experience ?? 0}–${job.max_years_experience ?? '?'} yrs`
        : '';
    const skills = (job.standardized_skills ?? job.skills ?? []) as string[];
    const daysOpen = daysBetween(job.created_at);
    lines.push('JOB');
    lines.push(
      [
        `Title: ${job.title}`,
        job.department ? `Department: ${job.department}` : '',
        job.location ? `Location: ${job.location}${job.work_mode ? ' (' + job.work_mode + ')' : ''}` : '',
        job.status ? `Status: ${job.status}` : '',
        job.job_level ? `Level: ${job.job_level}` : '',
        job.employment_type ? `Employment: ${job.employment_type}` : '',
        salary ? `Salary: ${salary}` : '',
        exp ? `Experience: ${exp}` : '',
        skills.length ? `Skills: ${skills.slice(0, 15).join(', ')}` : '',
        job.target_fill_date ? `Target fill: ${fmtDate(job.target_fill_date)}` : '',
        `Created: ${fmtDate(job.created_at)}${daysOpen != null ? ' (' + daysOpen + 'd open)' : ''}`,
      ]
        .filter(Boolean)
        .map((l) => '  ' + l)
        .join('\n'),
    );
    lines.push('');

    // STAGES
    if (stageList.length) {
      lines.push('STAGES (position · name · in_stage)');
      for (const s of stageList) {
        const label = (s.custom_stage_name || s.stage?.stage_name || 'Stage').trim();
        const inStage = stageCount[s.id] ?? 0;
        const sla = s.sla_days ? ` · SLA ${s.sla_days}d` : '';
        lines.push(`  ${s.position + 1}. ${label} — ${inStage}${sla}`);
      }
      const unassigned = stageCount['unassigned'] ?? 0;
      if (unassigned) lines.push(`  (unassigned stage) — ${unassigned}`);
      lines.push('');
    }

    // PIPELINE
    const medReject = median(daysToReject);
    lines.push('PIPELINE');
    lines.push(
      `  Applications: ${appList.length} · Active: ${activeCount} · Rejected: ${rejectedCount} · Offered: ${offeredCount} · Hired: ${hiredCount}`,
    );
    if (medReject != null) lines.push(`  Median days-to-reject: ${medReject}d`);
    if (Object.keys(statusCount).length) {
      lines.push(
        '  Status breakdown: ' +
          Object.entries(statusCount)
            .map(([k, v]) => `${k}=${v}`)
            .join(', '),
      );
    }
    lines.push('');

    // TOP REJECTION REASONS
    const topReasons = Object.entries(rejectionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (topReasons.length) {
      lines.push('TOP REJECTION REASONS');
      for (const [label, n] of topReasons) lines.push(`  ${label} — ${n}`);
      lines.push('');
    }

    // RECENT 7d / 14d — build unified event list
    const cutoff7Ms = now.getTime() - 7 * 86400000;
    type Ev = { ts: string; text: string; days: number };
    const events: Ev[] = [];

    for (const a of appList) {
      const cname = candidateName(candidatesById.get(a.candidate_id));
      const stage = a.current_stage_id ? stageLabelById.get(a.current_stage_id) ?? 'Stage' : 'Unassigned';
      if (a.rejected_at && new Date(a.rejected_at).getTime() >= cutoff7Ms - 7 * 86400000) {
        const reason = a.rejection_reason_id
          ? rrLabelById.get(a.rejection_reason_id) ?? 'Reason'
          : 'No reason';
        events.push({
          ts: a.rejected_at,
          text: `rejected: ${cname} — ${reason} (at ${stage})`,
          days: daysBetween(a.rejected_at) ?? 0,
        });
      }
      if (a.hired_at) {
        events.push({
          ts: a.hired_at,
          text: `hired: ${cname}`,
          days: daysBetween(a.hired_at) ?? 0,
        });
      }
      if (a.offered_at) {
        events.push({
          ts: a.offered_at,
          text: `offered: ${cname}`,
          days: daysBetween(a.offered_at) ?? 0,
        });
      }
      if (a.entered_stage_at && new Date(a.entered_stage_at).getTime() >= new Date(cutoff14).getTime()) {
        events.push({
          ts: a.entered_stage_at,
          text: `stage: ${cname} → ${stage}`,
          days: daysBetween(a.entered_stage_at) ?? 0,
        });
      }
      if (a.created_at && new Date(a.created_at).getTime() >= new Date(cutoff14).getTime()) {
        events.push({
          ts: a.created_at,
          text: `applied: ${cname}`,
          days: daysBetween(a.created_at) ?? 0,
        });
      }
    }

    for (const act of recentActivities) {
      const who =
        act.entity_type === 'candidate'
          ? candidateName(candidatesById.get(act.entity_id))
          : job.title;
      events.push({
        ts: act.created_at,
        text: `${act.activity_type}: ${who} — ${(act.title ?? '').slice(0, 120)}`,
        days: daysBetween(act.created_at) ?? 0,
      });
    }

    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    const in7 = events.filter((e) => new Date(e.ts).getTime() >= cutoff7Ms);
    const in14only = events.filter(
      (e) => new Date(e.ts).getTime() < cutoff7Ms,
    );

    if (in7.length) {
      lines.push('RECENT 7d (newest first)');
      for (const e of in7.slice(0, CONTEXT_RECENT_LIMIT)) {
        lines.push(`  ${fmtDate(e.ts)} · ${e.text}`);
      }
      lines.push('');
    }
    if (in14only.length) {
      lines.push('RECENT 8–14d');
      for (const e of in14only.slice(0, CONTEXT_RECENT_LIMIT)) {
        lines.push(`  ${fmtDate(e.ts)} · ${e.text}`);
      }
      lines.push('');
    }

    // CANDIDATES (active, grouped by stage position order)
    const activeApps = appList.filter((a) => !a.rejected_at && !a.hired_at);
    activeApps.sort((a, b) => {
      const pa = stageList.findIndex((s) => s.id === a.current_stage_id);
      const pb = stageList.findIndex((s) => s.id === b.current_stage_id);
      return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
    });

    const renderCandidateLine = (c: any) => {
      const role = c.current_job_title || c.role_current || '';
      const company = c.company_current || '';
      const roleCo = [role, company].filter(Boolean).join(' @ ');
      const loc = candidateLoc(c);
      const comp = formatSalary(c.salary_amount, c.salary_currency, c.salary_period);
      const exp = c.years_experience != null ? `${c.years_experience}y exp` : '';
      const seniority = c.seniority_level ? `sen=${c.seniority_level}` : '';
      const skillsArr = (c.standardized_skills ?? c.skills ?? []) as any[];
      const skills = skillsArr.length ? `skills=${skillsArr.slice(0, 6).map((s: any) => (typeof s === 'string' ? s : s?.name ?? '')).filter(Boolean).join(', ')}` : '';
      const src = c.source ? `src=${c.source}` : (c.job_board_source ? `src=${c.job_board_source}` : '');
      const contact: string[] = [];
      if (c.email) contact.push('email');
      if (c.phone) contact.push('phone');
      if (c.linkedin_url) contact.push('linkedin');
      const contactStr = contact.length ? `has=${contact.join('/')}` : '';
      return [
        roleCo,
        loc,
        comp ? `comp=${comp}` : '',
        exp,
        seniority,
        src,
        skills,
        contactStr,
      ].filter(Boolean).join(' · ');
    };

    const renderScorecards = (candidateId: string): string[] => {
      const list = (scorecardsByCandidate.get(candidateId) ?? []).slice(0, SCORECARDS_PER_CANDIDATE);
      const out: string[] = [];
      for (const s of list) {
        const stage = s.stage_instance_id ? stageLabelById.get(s.stage_instance_id) ?? 'Stage' : 'Stage';
        const rating = s.rating != null ? `rating=${s.rating}/5` : 'rating=—';
        const draft = s.is_ai_draft ? ' (AI draft)' : '';
        const ago = daysBetween(s.created_at);
        const overview = (s.general_overview ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
        const topResp = (s.responses ?? []).find((r) => r.answer_text && r.answer_text.trim().length > 4);
        const respSnip = topResp ? ` · "${topResp.question_text.slice(0, 40)}": ${topResp.answer_text!.replace(/\s+/g, ' ').trim().slice(0, 120)}` : '';
        const overviewSnip = overview ? ` · "${overview}"` : '';
        out.push(`    ↳ scorecard ${stage} · ${rating}${draft} · ${ago ?? 0}d ago${overviewSnip}${respSnip}`);
      }
      return out;
    };

    if (activeApps.length) {
      lines.push(`CANDIDATES · active (up to ${CONTEXT_ACTIVE_LIMIT}, grouped by stage)`);
      for (const a of activeApps.slice(0, CONTEXT_ACTIVE_LIMIT)) {
        const c = candidatesById.get(a.candidate_id) ?? {};
        const stage = a.current_stage_id ? stageLabelById.get(a.current_stage_id) ?? 'Stage' : 'Unassigned';
        const days = daysBetween(a.entered_stage_at) ?? daysBetween(a.created_at) ?? 0;
        lines.push(`  ${stage} · ${candidateName(c)} · ${renderCandidateLine(c)} · ${days}d in stage`);
        const wl = renderWorkLine(a.candidate_id);
        if (wl) lines.push(wl);
        for (const l of renderScorecards(a.candidate_id)) lines.push(l);
      }
      lines.push('');
    }

    // CANDIDATES (rejected, most recent first)
    const rejectedApps = appList
      .filter((a) => !!a.rejected_at)
      .sort((a, b) => new Date(b.rejected_at).getTime() - new Date(a.rejected_at).getTime());
    if (rejectedApps.length) {
      lines.push(`CANDIDATES · rejected (up to ${CONTEXT_REJECTED_LIMIT}, most recent first)`);
      for (const a of rejectedApps.slice(0, CONTEXT_REJECTED_LIMIT)) {
        const c = candidatesById.get(a.candidate_id) ?? {};
        const stage = a.current_stage_id ? stageLabelById.get(a.current_stage_id) ?? 'Stage' : '—';
        const reason = a.rejection_reason_id
          ? rrLabelById.get(a.rejection_reason_id) ?? 'Reason'
          : 'No reason';
        const ago = daysBetween(a.rejected_at) ?? 0;
        lines.push(
          `  ${candidateName(c)} · stage=${stage} · reason=${reason} · ${ago}d ago · ${renderCandidateLine(c)}`,
        );
        for (const l of renderScorecards(a.candidate_id)) lines.push(l);
      }
      lines.push('');
    }

    // COMPENSATION ASKS (active only)
    const compRows = activeApps
      .map((a) => {
        const c = candidatesById.get(a.candidate_id) ?? {};
        const amt = typeof c.salary_amount === 'string' ? parseFloat(c.salary_amount) : c.salary_amount;
        if (!amt || Number.isNaN(amt)) return null;
        return {
          name: candidateName(c),
          amt: amt as number,
          formatted: formatSalary(amt, c.salary_currency, c.salary_period) ?? String(amt),
          currency: (c.salary_currency || 'USD').toUpperCase(),
        };
      })
      .filter((x): x is { name: string; amt: number; formatted: string; currency: string } => !!x)
      .sort((a, b) => b.amt - a.amt);
    if (compRows.length) {
      lines.push('COMPENSATION ASKS · active');
      const amts = compRows.map((r) => r.amt);
      const min = Math.min(...amts);
      const max = Math.max(...amts);
      const med = median(amts) ?? 0;
      const cur = compRows[0].currency;
      lines.push(`  Summary (${cur}, n=${compRows.length}): min=${min}, median=${med}, max=${max}`);
      for (const r of compRows.slice(0, 40)) lines.push(`  ${r.name} — ${r.formatted}`);
      lines.push('');
    }

    // LOCATIONS (active only)
    const locCount = new Map<string, number>();
    for (const a of activeApps) {
      const c = candidatesById.get(a.candidate_id) ?? {};
      const loc = candidateLoc(c) || 'Unknown';
      locCount.set(loc, (locCount.get(loc) ?? 0) + 1);
    }
    if (locCount.size) {
      lines.push('LOCATIONS · active');
      const sorted = [...locCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
      for (const [loc, n] of sorted) lines.push(`  ${loc} — ${n}`);
      lines.push('');
    }


    // JOB DESCRIPTION excerpt
    if (job.description) {
      const excerpt = String(job.description).replace(/\s+/g, ' ').trim().slice(0, 800);
      lines.push('JOB DESCRIPTION (excerpt)');
      lines.push('  ' + excerpt);
    }

    let contextBlock = lines.join('\n');
    if (contextBlock.length > MAX_CONTEXT_CHARS) {
      contextBlock = contextBlock.slice(0, MAX_CONTEXT_CHARS) + '\n… [truncated]';
    }

    // ── Prompt ────────────────────────────────────────────────
    const history: Msg[] = historyRaw
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-8);

    const messages = [
      {
        role: 'system' as const,
        content: [
          'You are Gio, a concise hiring copilot.',
          'Answer the recruiter\u2019s question about THIS job using ONLY the provided context.',
          'The context is structured into sections: JOB, STAGES, PIPELINE, TOP REJECTION REASONS, RECENT 7d, RECENT 8–14d, CANDIDATES · active, CANDIDATES · rejected, COMPENSATION ASKS, LOCATIONS, JOB DESCRIPTION.',
          'Each candidate line may include: stage, name, role @ company, location, comp=salary expectation, years of experience, seniority, source, top skills, and contact availability (email/phone/linkedin). Sub-lines starting with "↳ scorecard" are interview scorecards with rating (0–5), age, and a short overview/answer snippet.',
          'Answer questions about salary, location, skills, experience, source, and interview feedback by citing these fields directly.',
          'When the user asks about a time window (e.g. "last 7 days"), filter events from the RECENT sections by date.',
          'When asked for a pipeline report, group active candidates by stage and include rejected candidates from the CANDIDATES · rejected block.',
          'Cite counts, candidate names, salaries, locations, and ratings from the context only — never invent values. If a field is missing for a candidate, say "not on file" rather than guessing.',
          'If the context is insufficient, say so briefly and suggest what data would help.',
          'Be terse. Prefer short paragraphs and light markdown (bold, bullet lists).',
          '',
          'JOB CONTEXT:',
          contextBlock,
        ].join('\n'),
      },
      ...history,
      { role: 'user' as const, content: question },
    ];

    const gwRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    if (!gwRes.ok) {
      const text = await gwRes.text().catch(() => '');
      const status = gwRes.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit reached. Please try again in a moment.' }),
          { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({
            error: 'AI credits exhausted. Add credits in Workspace billing to continue.',
          }),
          { status: 402, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ error: `AI gateway error (${status}): ${text.slice(0, 300)}` }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const gwJson = await gwRes.json();
    const answer: string =
      gwJson?.choices?.[0]?.message?.content?.toString().trim() ?? '';
    if (!answer) {
      return new Response(JSON.stringify({ error: 'Empty response from AI.' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[job-ask-gio] error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
