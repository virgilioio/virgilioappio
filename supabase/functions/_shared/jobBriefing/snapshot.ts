// buildJobSnapshot(jobId) — deterministic SQL-driven snapshot.
// No AI, no opinion. Pure facts.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  OFFER_STAGE_TYPES,
  TERMINAL_STATUSES,
} from './constants.ts';
import { classifyCandidateSource, incrementSourceBreakdown, type SourceKind } from './sourceClassifier.ts';

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
    unknown_source_total: number;
    source_breakdown: Record<SourceKind, number>;
    last_activity_at: string | null;
    stages: Array<{
      id: string;
      base_stage_id: string;
      stage: string;
      stage_type: string;
      position: number;
      sla_days: number | null;
      active_count: number;
      total_count: number;
      rejected_count: number;
      withdrawn_count: number;
      hired_count: number;
      median_days_in_stage: number | null;
      max_days_in_stage: number | null;
      source_breakdown: Record<SourceKind, number>;
      candidates: Array<{ id: string; name: string; days_in_stage: number; source_kind: SourceKind; source_label: string }>;
    }>;
    stages_from_offer: Record<string, number>;
    stage_conversion: Array<{
      stage: string;
      position: number;
      entered: number;
      advanced: number;
      rejected: number;
      conversion_to_next_pct: number | null;
      rejection_pct: number | null;
    }>;
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
    median_days_between_stage_moves: number | null;
    transitions_last_7d: number;
    transitions_last_14d: number;
    forward_moves_last_14d: number;
  };
  scorecards: {
    total: number;
    submitted: number;
    ai_drafts: number;
    by_rating: Record<string, number>;
    recent: Array<{
      candidate_id: string | null;
      candidate_name: string;
      stage: string | null;
      rating: string | null;
      is_ai_draft: boolean;
      overview: string | null;
      created_at: string;
    }>;
  };
  interviews: {
    total: number;
    upcoming: number;
    completed: number;
    cancelled: number;
    recent_completed_14d: number;
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
    .select('id, position, custom_stage_name, stage_id, sla_days, job_stages:stage_id (id, stage_name, stage_type)')
    .eq('job_id', jobId)
    .order('position', { ascending: true });
  if (hsErr) throw hsErr;

  type StageDef = { id: string; baseStageId: string; name: string; type: string; position: number; slaDays: number | null };
  const stageDefs: StageDef[] = (hiringStages ?? []).map((row: any) => ({
    id: row.id,
    baseStageId: row.stage_id,
    name: row.custom_stage_name || row.job_stages?.stage_name || 'Unnamed',
    type: row.job_stages?.stage_type || 'custom',
    position: row.position ?? 0,
    slaDays: row.sla_days ?? null,
  }));
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
    .select('id, candidate_id, status, current_stage_id, entered_stage_at, created_at, updated_at, rejected_at, offered_at, hired_at, candidates:candidate_id (id, candidate_name, source, job_board_source, salary_amount, salary_currency, salary_period, location_country, location_state, location_city, skills, standardized_skills)')
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
  let inboundLast30 = 0, inboundTotal = 0, sourcedTotal = 0, unknownSourceTotal = 0;
  const pipelineSourceBreakdown: Record<SourceKind, number> = { inbound: 0, sourced: 0, unknown: 0 };
  for (const a of list) {
    const c = (a as any).candidates;
    const classified = classifyCandidateSource(c?.source, c?.job_board_source);
    incrementSourceBreakdown(pipelineSourceBreakdown, classified);
    if (classified.kind === 'inbound') {
      inboundTotal++;
      if (new Date(a.created_at) >= thirty) inboundLast30++;
    }
    if (classified.kind === 'sourced') sourcedTotal++;
    if (classified.kind === 'unknown') unknownSourceTotal++;
  }

  // Last activity (max updated_at across associations) + stage_events
  let lastActivityAt: string | null = null;
  for (const a of list) {
    const t = a.updated_at || a.created_at;
    if (t && (!lastActivityAt || t > lastActivityAt)) lastActivityAt = t;
  }

  // Stage events (last 7d transitions, plus rejection timing fallback)
  const sevenAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const { data: recentEvents } = await client
    .from('stage_events')
    .select('id, occurred_at, reason')
    .eq('job_id', jobId)
    .gte('occurred_at', fourteenAgo);
  const transitionsLast7d = (recentEvents ?? []).filter(
    (e: any) => e.reason !== 'backfill' && e.occurred_at && new Date(e.occurred_at) >= new Date(sevenAgo),
  ).length;
  const transitionsLast14d = (recentEvents ?? []).filter((e: any) => e.reason !== 'backfill').length;

  // Per-stage breakdown (active only)
  const stageBuckets = new Map<string, {
    active: number;
    total: number;
    rejected: number;
    withdrawn: number;
    hired: number;
    durations: number[];
    cands: Array<{ id: string; name: string; days_in_stage: number; source_kind: SourceKind; source_label: string }>;
    sources: Record<SourceKind, number>;
  }>();
  for (const s of stageDefs) {
    stageBuckets.set(s.id, {
      active: 0,
      total: 0,
      rejected: 0,
      withdrawn: 0,
      hired: 0,
      durations: [],
      cands: [],
      sources: { inbound: 0, sourced: 0, unknown: 0 },
    });
  }
  for (const a of list) {
    const sid = a.current_stage_id;
    if (!sid || !stageBuckets.has(sid)) continue;
    const bucket = stageBuckets.get(sid)!;
    bucket.total++;
    if (a.status === 'rejected') bucket.rejected++;
    if (a.status === 'withdrawn') bucket.withdrawn++;
    if (a.status === 'hired') bucket.hired++;
    const c = (a as any).candidates;
    const classified = classifyCandidateSource(c?.source, c?.job_board_source);
    incrementSourceBreakdown(bucket.sources, classified);
    if (TERMINAL_STATUSES.has(a.status)) continue;
    const enteredAt = a.entered_stage_at ? new Date(a.entered_stage_at) : new Date(a.created_at);
    const days = daysBetween(enteredAt, now);
    bucket.active++;
    bucket.durations.push(days);
    bucket.cands.push({
      id: c?.id ?? a.candidate_id,
      name: c?.candidate_name ?? 'Unknown',
      days_in_stage: days,
      source_kind: classified.kind,
      source_label: classified.label,
    } as any);
  }

  const stages = stageDefs.map((s) => {
    const b = stageBuckets.get(s.id)!;
    b.cands.sort((x, y) => y.days_in_stage - x.days_in_stage);
    return {
      id: s.id,
      base_stage_id: s.baseStageId,
      stage: s.name,
      stage_type: s.type,
      position: s.position,
      sla_days: s.slaDays,
      active_count: b.active,
      total_count: b.total,
      rejected_count: b.rejected,
      withdrawn_count: b.withdrawn,
      hired_count: b.hired,
      median_days_in_stage: median(b.durations),
      max_days_in_stage: b.durations.length ? Math.max(...b.durations) : null,
      source_breakdown: b.sources,
      candidates: b.cands,
    };
  });

  // Stage conversion and movement velocity -----------------------------------
  const assocIds = list.map((a: any) => a.id).filter(Boolean);
  let stageHistory: any[] = [];
  for (let i = 0; i < assocIds.length; i += 500) {
    const chunk = assocIds.slice(i, i + 500);
    if (!chunk.length) continue;
    const { data, error } = await client
      .from('job_candidate_stage_history')
      .select('association_id, from_stage_id, to_stage_id, moved_at')
      .in('association_id', chunk);
    if (!error) stageHistory = stageHistory.concat(data ?? []);
  }

  const stageConversion = stageDefs.map((s) => {
    const fromMoves = stageHistory.filter((h) => h.from_stage_id === s.id);
    const advanced = fromMoves.filter((h) => h.to_stage_id && h.to_stage_id !== h.from_stage_id).length;
    const rejectedFromStage = list.filter((a: any) => a.current_stage_id === s.id && a.status === 'rejected').length;
    const entered = (stageBuckets.get(s.id)?.total ?? 0) + advanced;
    const denominator = advanced + rejectedFromStage;
    return {
      stage: s.name,
      position: s.position,
      entered,
      advanced,
      rejected: rejectedFromStage,
      conversion_to_next_pct: denominator > 0 ? advanced / denominator : null,
      rejection_pct: denominator > 0 ? rejectedFromStage / denominator : null,
    };
  });

  const moveDurations: number[] = [];
  let forwardMovesLast14d = 0;
  const stagePositionById = new Map(stageDefs.map((s) => [s.id, s.position] as const));
  for (const h of stageHistory) {
    if (h.moved_at && new Date(h.moved_at) >= new Date(fourteenAgo)) {
      const fromPos = h.from_stage_id ? stagePositionById.get(h.from_stage_id) : null;
      const toPos = h.to_stage_id ? stagePositionById.get(h.to_stage_id) : null;
      if (fromPos != null && toPos != null && toPos > fromPos) forwardMovesLast14d++;
    }
    const assoc = list.find((a: any) => a.id === h.association_id);
    const started = assoc?.created_at ? new Date(assoc.created_at) : null;
    if (started && h.moved_at) moveDurations.push(daysBetween(started, new Date(h.moved_at)));
  }

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

  // Scorecards ----------------------------------------------------------------
  let scorecards: JobSnapshot['scorecards'] = {
    total: 0,
    submitted: 0,
    ai_drafts: 0,
    by_rating: {},
    recent: [],
  };
  const { data: scorecardRows } = await client
    .from('job_stage_scorecards')
    .select('candidate_id, stage_instance_id, rating, general_overview, created_at, is_ai_draft')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(100);
  const candidateNameById = new Map<string, string>();
  for (const a of list) {
    const c = (a as any).candidates;
    if (a.candidate_id) candidateNameById.set(a.candidate_id, c?.candidate_name ?? 'Unknown');
  }
  const stageNameById = new Map(stageDefs.map((s) => [s.id, s.name] as const));
  for (const sc of scorecardRows ?? []) {
    const rating = sc.rating ? String(sc.rating) : 'unrated';
    scorecards.total++;
    if (sc.is_ai_draft) scorecards.ai_drafts++;
    else scorecards.submitted++;
    scorecards.by_rating[rating] = (scorecards.by_rating[rating] ?? 0) + 1;
  }
  scorecards.recent = (scorecardRows ?? []).slice(0, 8).map((sc: any) => ({
    candidate_id: sc.candidate_id ?? null,
    candidate_name: sc.candidate_id ? candidateNameById.get(sc.candidate_id) ?? 'Unknown' : 'Unknown',
    stage: sc.stage_instance_id ? stageNameById.get(sc.stage_instance_id) ?? null : null,
    rating: sc.rating ? String(sc.rating) : null,
    is_ai_draft: !!sc.is_ai_draft,
    overview: sc.general_overview ? String(sc.general_overview).replace(/\s+/g, ' ').trim().slice(0, 240) : null,
    created_at: sc.created_at,
  }));

  // Interviews ----------------------------------------------------------------
  const { data: bookingRows } = await client
    .from('scheduled_bookings')
    .select('scheduled_start, status, cancelled_at')
    .eq('job_id', jobId);
  const interviews = { total: 0, upcoming: 0, completed: 0, cancelled: 0, recent_completed_14d: 0 };
  for (const b of bookingRows ?? []) {
    interviews.total++;
    const start = b.scheduled_start ? new Date(b.scheduled_start) : null;
    const status = norm(b.status);
    if (status === 'cancelled' || b.cancelled_at) interviews.cancelled++;
    else if (start && start > now) interviews.upcoming++;
    else if (start) {
      interviews.completed++;
      if (start >= new Date(fourteenAgo)) interviews.recent_completed_14d++;
    }
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
      unknown_source_total: unknownSourceTotal,
      source_breakdown: pipelineSourceBreakdown,
      last_activity_at: lastActivityAt,
      stages,
      stages_from_offer: stagesFromOffer,
      stage_conversion: stageConversion,
    },
    composition: { salary, location, skills },
    velocity: {
      median_days_to_rejection: median(rejectionDurations),
      median_days_between_stage_moves: median(moveDurations),
      transitions_last_7d: transitionsLast7d,
      transitions_last_14d: transitionsLast14d,
      forward_moves_last_14d: forwardMovesLast14d,
    },
    scorecards,
    interviews,
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
