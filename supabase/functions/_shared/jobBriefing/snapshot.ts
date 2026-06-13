// buildJobSnapshot(jobId) — deterministic SQL-driven snapshot.
// No AI, no opinion. Pure facts.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  PRE_INTERVIEW_STAGE_TYPES,
  OFFER_STAGE_TYPES,
  TERMINAL_STATUSES,
} from './constants.ts';

export type JobSnapshot = {
  job: {
    id: string;
    title: string;
    status: string;
    days_open: number;
    location_requirement: string | null;
    budget: {
      min: number | null;
      max: number | null;
      currency: string;
      period: string;
    } | null;
    target_fill_date: string | null;
    must_have_skills: string[];
  };
  pipeline: {
    active_count: number;
    rejected_count: number;
    withdrawn_count: number;
    hired_count: number;
    inbound_last_30d: number;
    inbound_total: number;
    sourced_total: number;
    last_activity_at: string | null;
    stages: Array<{
      stage: string;
      stage_type: string;
      position: number;
      active_count: number;
      median_days_in_stage: number | null;
      candidates: Array<{ id: string; name: string; days_in_stage: number }>;
    }>;
    stages_from_offer: Record<string, number>;
  };
  composition: {
    salary: {
      data_points: number;
      coverage_pct: number;
      median: number;
      p10: number;
      p90: number;
    } | null;
    location: {
      data_points: number;
      in_range_pct: number;
    } | null;
    skills: {
      data_points: number;
      all_musthaves_pct: number;
      per_skill: Record<string, number>;
    } | null;
  };
  velocity: {
    median_days_to_rejection: number | null;
    transitions_last_7d: number;
  };
};

// --- small helpers ----------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))));
  return s[idx];
}

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

// Stable hash for change-detection. Sort-keys + djb2.
function stableHash(value: unknown): string {
  const json = stableStringify(value);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((v as any)[k])).join(',') + '}';
}

// ---------------------------------------------------------------------------

export async function buildJobSnapshot(
  client: SupabaseClient,
  jobId: string,
): Promise<{ snapshot: JobSnapshot; snapshot_hash: string }> {
  const now = new Date();

  // Job ----------------------------------------------------------------------
  const { data: job, error: jobErr } = await client
    .from('jobs')
    .select(
      'id, title, status, created_at, budget_salary_min, budget_salary_max, budget_currency, budget_period, target_fill_date, must_have_skills, location_requirement, location',
    )
    .eq('id', jobId)
    .maybeSingle();
  if (jobErr) throw jobErr;
  if (!job) throw new Error(`Job ${jobId} not found`);

  const daysOpen = daysBetween(new Date(job.created_at), now);

  // Stages (ordered) ---------------------------------------------------------
  const { data: hiringStages, error: hsErr } = await client
    .from('job_hiring_stages')
    .select('position, custom_stage_name, stage_id, job_stages:stage_id (id, stage_name, stage_type)')
    .eq('job_id', jobId)
    .order('position', { ascending: true });
  if (hsErr) throw hsErr;

  type StageDef = { id: string; name: string; type: string; position: number };
  const stageDefs: StageDef[] = (hiringStages ?? []).map((row: any) => ({
    id: row.stage_id,
    name: row.custom_stage_name || row.job_stages?.stage_name || 'Unnamed',
    type: row.job_stages?.stage_type || 'custom',
    position: row.position ?? 0,
  }));
  const stageById = new Map<string, StageDef>(stageDefs.map((s) => [s.id, s]));

  // Offer-anchor index (first stage of type offer, else last stage).
  const offerIdx = (() => {
    const i = stageDefs.findIndex((s) => OFFER_STAGE_TYPES.has(s.type));
    return i >= 0 ? i : Math.max(0, stageDefs.length - 1);
  })();
  const stagesFromOffer: Record<string, number> = {};
  stageDefs.forEach((s, i) => { stagesFromOffer[s.name] = Math.max(0, offerIdx - i); });

  // Associations -------------------------------------------------------------
  const { data: assocs, error: aErr } = await client
    .from('job_candidate_associations')
    .select('id, candidate_id, status, current_stage_id, entered_stage_at, created_at, updated_at, rejected_at, candidates:candidate_id (id, candidate_name, source, salary_amount, salary_currency, salary_period, location_country, location_state, location_city, skills, standardized_skills)')
    .eq('job_id', jobId);
  if (aErr) throw aErr;

  const list = assocs ?? [];

  // Counters by status
  let activeCount = 0, rejectedCount = 0, withdrawnCount = 0, hiredCount = 0;
  for (const a of list) {
    switch (a.status) {
      case 'rejected': rejectedCount++; break;
      case 'withdrawn': withdrawnCount++; break;
      case 'hired': hiredCount++; break;
      default: activeCount++;
    }
  }

  // Inbound / sourced (heuristic from candidates.source)
  const thirty = new Date(now.getTime() - 30 * 86_400_000);
  let inboundLast30 = 0, inboundTotal = 0, sourcedTotal = 0;
  for (const a of list) {
    const src = norm((a as any).candidates?.source);
    const isInbound = /apply|application|career|job.?board|portal|inbound|website/.test(src) ||
                      src === '' /* unknown defaults to inbound-ish nothing? */ && false;
    const isSourced = /sourc|outreach|chrome|extension|apollo|coresignal|pdl|manual/.test(src);
    if (isInbound) {
      inboundTotal++;
      if (new Date(a.created_at) >= thirty) inboundLast30++;
    }
    if (isSourced) sourcedTotal++;
  }

  // Last activity (max updated_at across associations) + stage_events
  let lastActivityAt: string | null = null;
  for (const a of list) {
    const t = a.updated_at || a.created_at;
    if (t && (!lastActivityAt || t > lastActivityAt)) lastActivityAt = t;
  }

  // Stage events (last 7d transitions, plus rejection timing fallback)
  const sevenAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data: recentEvents } = await client
    .from('stage_events')
    .select('id, occurred_at, reason')
    .eq('job_id', jobId)
    .gte('occurred_at', sevenAgo);
  const transitionsLast7d = (recentEvents ?? []).filter((e: any) => e.reason !== 'backfill').length;

  // Per-stage breakdown (active only)
  const stageBuckets = new Map<string, { active: number; durations: number[]; cands: Array<{ id: string; name: string; days: number }> }>();
  for (const s of stageDefs) stageBuckets.set(s.id, { active: 0, durations: [], cands: [] });
  for (const a of list) {
    if (TERMINAL_STATUSES.has(a.status)) continue;
    const sid = a.current_stage_id;
    if (!sid || !stageBuckets.has(sid)) continue;
    const enteredAt = a.entered_stage_at ? new Date(a.entered_stage_at) : new Date(a.created_at);
    const days = daysBetween(enteredAt, now);
    const bucket = stageBuckets.get(sid)!;
    bucket.active++;
    bucket.durations.push(days);
    bucket.cands.push({
      id: (a as any).candidates?.id ?? a.candidate_id,
      name: (a as any).candidates?.candidate_name ?? 'Unknown',
      days_in_stage: days,
    } as any);
  }

  const stages = stageDefs.map((s) => {
    const b = stageBuckets.get(s.id)!;
    b.cands.sort((x, y) => y.days_in_stage - x.days_in_stage);
    return {
      stage: s.name,
      stage_type: s.type,
      position: s.position,
      active_count: b.active,
      median_days_in_stage: median(b.durations),
      candidates: b.cands,
    };
  });

  // Composition --------------------------------------------------------------
  // Salary — only candidates whose currency/period match the job's budget basis (when set).
  const budgetCur = (job.budget_currency || 'MXN').toUpperCase();
  const budgetPer = (job.budget_period || 'monthly').toLowerCase();
  const salaryValues: number[] = [];
  let salaryEligible = 0;
  for (const a of list) {
    const c = (a as any).candidates;
    if (!c) continue;
    salaryEligible++;
    if (c.salary_amount == null) continue;
    const cur = String(c.salary_currency || '').toUpperCase();
    const per = String(c.salary_period || '').toLowerCase();
    // Only compare like-for-like; mismatch is excluded (no conversion guesses).
    if (cur && cur !== budgetCur) continue;
    if (per && per !== budgetPer) continue;
    salaryValues.push(Number(c.salary_amount));
  }
  const salary = salaryValues.length > 0
    ? {
        data_points: salaryValues.length,
        coverage_pct: salaryEligible ? salaryValues.length / salaryEligible : 0,
        median: median(salaryValues)!,
        p10: percentile(salaryValues, 10),
        p90: percentile(salaryValues, 90),
      }
    : null;

  // Location — substring match against job.location (or country fallback).
  const jobLoc = norm(job.location);
  let locDataPoints = 0, locInRange = 0;
  if (jobLoc || job.location_requirement === 'remote') {
    for (const a of list) {
      const c = (a as any).candidates;
      if (!c) continue;
      const parts = [c.location_city, c.location_state, c.location_country].filter(Boolean).map(norm).join(' ');
      if (!parts) continue;
      locDataPoints++;
      if (job.location_requirement === 'remote') { locInRange++; continue; }
      if (jobLoc && parts.includes(jobLoc)) locInRange++;
    }
  }
  const location = locDataPoints > 0
    ? { data_points: locDataPoints, in_range_pct: locInRange / locDataPoints }
    : null;

  // Skills — must-haves coverage.
  const musts = (job.must_have_skills ?? []).map(norm).filter(Boolean);
  let skills: JobSnapshot['composition']['skills'] = null;
  if (musts.length > 0) {
    const perSkillHits: Record<string, number> = {};
    musts.forEach((m) => { perSkillHits[m] = 0; });
    let skDataPoints = 0, allHaveAll = 0;
    for (const a of list) {
      const c = (a as any).candidates;
      if (!c) continue;
      const cs = new Set<string>([
        ...((c.standardized_skills ?? []) as string[]).map(norm),
        ...((c.skills ?? []) as string[]).map(norm),
      ].filter(Boolean));
      if (cs.size === 0) continue;
      skDataPoints++;
      let allHave = true;
      for (const m of musts) {
        if (cs.has(m)) perSkillHits[m]++;
        else allHave = false;
      }
      if (allHave) allHaveAll++;
    }
    if (skDataPoints > 0) {
      const perSkill: Record<string, number> = {};
      for (const m of musts) perSkill[m] = skDataPoints ? perSkillHits[m] / skDataPoints : 0;
      skills = {
        data_points: skDataPoints,
        all_musthaves_pct: allHaveAll / skDataPoints,
        per_skill: perSkill,
      };
    }
  }

  // Velocity -----------------------------------------------------------------
  const rejectionDurations: number[] = [];
  for (const a of list) {
    if (a.status !== 'rejected') continue;
    const startedAt = new Date(a.created_at);
    const endedAt = a.rejected_at ? new Date(a.rejected_at) : new Date(a.updated_at || a.created_at);
    rejectionDurations.push(daysBetween(startedAt, endedAt));
  }

  const snapshot: JobSnapshot = {
    job: {
      id: job.id,
      title: job.title,
      status: job.status,
      days_open: daysOpen,
      location_requirement: job.location_requirement ?? null,
      budget: (job.budget_salary_min != null || job.budget_salary_max != null)
        ? {
            min: job.budget_salary_min ?? null,
            max: job.budget_salary_max ?? null,
            currency: budgetCur,
            period: budgetPer,
          }
        : null,
      target_fill_date: job.target_fill_date ?? null,
      must_have_skills: job.must_have_skills ?? [],
    },
    pipeline: {
      active_count: activeCount,
      rejected_count: rejectedCount,
      withdrawn_count: withdrawnCount,
      hired_count: hiredCount,
      inbound_last_30d: inboundLast30,
      inbound_total: inboundTotal,
      sourced_total: sourcedTotal,
      last_activity_at: lastActivityAt,
      stages,
      stages_from_offer: stagesFromOffer,
    },
    composition: { salary, location, skills },
    velocity: {
      median_days_to_rejection: median(rejectionDurations),
      transitions_last_7d: transitionsLast7d,
    },
  };

  // Hash excludes the last_activity_at timestamp (changes on read-only ops).
  const hashInput = JSON.parse(JSON.stringify(snapshot));
  delete hashInput.pipeline.last_activity_at;
  return { snapshot, snapshot_hash: stableHash(hashInput) };
}

// Re-export for callers that don't want their own client wiring.
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}
