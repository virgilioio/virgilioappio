// buildJobSnapshot(jobId) — deterministic SQL-driven snapshot.
// No AI, no opinion. Pure facts.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
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
    priority: string | null;
    work_mode: string | null;
    employment_type: string | null;
    job_level: string | null;
    years_experience: { min: number | null; max: number | null } | null;
    location: string | null;
    additional_locations: string[];
    location_requirement: string | null;
    budget: {
      min: number | null;
      max: number | null;
      currency: string;
      period: string;
    } | null;
    target_fill_date: string | null;
    must_have_skills: string[];
    team: {
      recruiters: number;
      hiring_managers: number;
      interviewers: number;
      has_reports_to: boolean;
      has_coordinator: boolean;
    };
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
    active_inbound_total: number;
    active_sourced_total: number;
    active_unknown_source_total: number;
    source_breakdown: Record<SourceKind, number>;
    source_labels: Record<string, number>;
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
      source_labels: Record<string, number>;
      candidates: Array<{ id: string; name: string; days_in_stage: number; source_kind: SourceKind; source_label: string }>;
      candidates_omitted: number;
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
      converted_data_points: number;
      basis: string;
      coverage_pct: number;
      median: number;
      p10: number;
      p90: number;
    } | null;
    location: {
      data_points: number;
      in_range_pct: number;
      basis: string;
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
    by_stage: Record<string, { submitted: number; by_rating: Record<string, number> }>;
    rated_score_questions: Array<{ question: string; responses: number; average: number }>;
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
    rescheduled: number;
    unconfirmed_upcoming: number;
    recent_completed_14d: number;
    next_scheduled_at: string | null;
  };
  rejections: {
    total: number;
    by_reason: Record<string, number>;
    by_category: Record<string, number>;
    by_stage: Record<string, number>;
  };
  offers: {
    total: number;
    drafts: number;
    sent: number;
    accepted: number;
    declined: number;
    approval_pending: number;
    approval_blocked: number;
  };
  communication: {
    outbound_total: number;
    inbound_total: number;
    candidates_contacted: number;
    replies: number;
    reply_rate_pct: number | null;
    median_hours_to_first_reply: number | null;
    awaiting_reply_over_3d: number;
    last_outbound_at: string | null;
  };
  references: {
    requests_total: number;
    by_state: Record<string, number>;
  };
  funnel: {
    postings_total: number;
    postings_active: number;
    applications_total: number;
    applications_last_30d: number;
    by_board: Record<string, number>;
  };
  benchmarks: {
    comparable_jobs: number;
    basis: string;
    median_days_to_hire: number | null;
    median_days_open_active: number | null;
    median_active_per_job: number | null;
    hire_rate_pct: number | null;
  } | null;
  trend: {
    since: string;
    days_since: number;
    active_delta: number;
    hired_delta: number;
    rejected_delta: number;
    forward_moves_last_14d_delta: number | null;
  } | null;
};

// --- small helpers ----------------------------------------------------------

// Payload discipline: the longest-waiting candidates per stage carry the signal.
const STAGE_CANDIDATE_LIMIT = 8;
export const ACTIVITY_WINDOW_DAYS = 14;

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

// --- salary normalisation ---------------------------------------------------
// Every period expressed as payments per month, so any pair can be converted.
const PERIODS_PER_MONTH: Record<string, number> = {
  annual: 1 / 12,
  yearly: 1 / 12,
  monthly: 1,
  semimonthly: 2,
  biweekly: 26 / 12,
  weekly: 52 / 12,
  daily: 260 / 12,
  hourly: 2080 / 12,
};

function toPeriod(amount: number, from: string, to: string): number | null {
  if (!Number.isFinite(amount)) return null;
  const f = PERIODS_PER_MONTH[from];
  const t = PERIODS_PER_MONTH[to];
  if (!f || !t) return from === to ? amount : null;
  const monthly = amount * f;
  return monthly / t;
}

type RateMap = Map<string, number>;

// Latest rate per currency pair for the tenant (falls back to global rows).
async function loadCurrencyRates(client: SupabaseClient, tenantId: string | null): Promise<RateMap> {
  const map: RateMap = new Map();
  const seen = new Set<string>();
  const { data } = await client
    .from('currency_rates')
    .select('tenant_id, base_currency, quote_currency, rate, rate_date')
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .order('rate_date', { ascending: false })
    .limit(2000);
  for (const row of data ?? []) {
    const base = String(row.base_currency ?? '').toUpperCase();
    const quote = String(row.quote_currency ?? '').toUpperCase();
    const rate = Number(row.rate);
    if (!base || !quote || !Number.isFinite(rate) || rate <= 0) continue;
    const key = `${base}:${quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    map.set(key, rate);
    if (!map.has(`${quote}:${base}`)) map.set(`${quote}:${base}`, 1 / rate);
  }
  return map;
}

function convertCurrency(amount: number, from: string, to: string, rates: RateMap): number | null {
  if (from === to) return amount;
  const direct = rates.get(`${from}:${to}`);
  if (direct) return amount * direct;
  // Cross through any shared pivot currency we have both legs for.
  for (const key of rates.keys()) {
    const [base, quote] = key.split(':');
    if (base !== from) continue;
    const second = rates.get(`${quote}:${to}`);
    if (second) return amount * rates.get(key)! * second;
  }
  return null;
}

// --- skill matching ---------------------------------------------------------
function skillKey(value: string): string {
  return value.toLowerCase().replace(/[\s._\-/+#]+/g, '').replace(/js$/, '').trim();
}

function skillMatches(must: string, candidateKeys: Set<string>): boolean {
  const key = skillKey(must);
  if (!key) return false;
  if (candidateKeys.has(key)) return true;
  // Contained-token match, guarded against very short keys producing noise.
  if (key.length < 4) return false;
  for (const candidateKey of candidateKeys) {
    if (candidateKey.length >= 4 && (candidateKey.includes(key) || key.includes(candidateKey))) return true;
  }
  return false;
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
      'id, title, status, created_at, tenant_id, organization_id, priority, work_mode, employment_type, job_level, min_years_experience, max_years_experience, additional_locations, reports_to_user_id, coordinator_user_id, budget_salary_min, budget_salary_max, budget_currency, budget_period, target_fill_date, must_have_skills, location_requirement, location, standardized_title',
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
    .select('id, candidate_id, status, current_stage_id, entered_stage_at, created_at, updated_at, rejected_at, rejection_reason_id, offered_at, hired_at, candidates:candidate_id (id, candidate_name, source, job_board_source, salary_amount, salary_currency, salary_period, location_country, location_state, location_city, skills, standardized_skills, seniority_level, current_job_title, years_experience)')
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
  let activeInboundTotal = 0, activeSourcedTotal = 0, activeUnknownSourceTotal = 0;
  const pipelineSourceBreakdown: Record<SourceKind, number> = { inbound: 0, sourced: 0, unknown: 0 };
  const pipelineSourceLabels: Record<string, number> = {};
  for (const a of list) {
    const c = (a as any).candidates;
    const classified = classifyCandidateSource(c?.source, c?.job_board_source);
    const isActive = !TERMINAL_STATUSES.has(a.status);
    incrementSourceBreakdown(pipelineSourceBreakdown, classified);
    pipelineSourceLabels[classified.label] = (pipelineSourceLabels[classified.label] ?? 0) + 1;
    if (classified.kind === 'inbound') {
      inboundTotal++;
      if (isActive) activeInboundTotal++;
      if (new Date(a.created_at) >= thirty) inboundLast30++;
    }
    if (classified.kind === 'sourced') {
      sourcedTotal++;
      if (isActive) activeSourcedTotal++;
    }
    if (classified.kind === 'unknown') {
      unknownSourceTotal++;
      if (isActive) activeUnknownSourceTotal++;
    }
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
    sourceLabels: Record<string, number>;
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
      sourceLabels: {},
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
    bucket.sourceLabels[classified.label] = (bucket.sourceLabels[classified.label] ?? 0) + 1;
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
      source_labels: b.sourceLabels,
      candidates: b.cands.slice(0, STAGE_CANDIDATE_LIMIT),
      candidates_omitted: Math.max(0, b.cands.length - STAGE_CANDIDATE_LIMIT),
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

  const stagePositionById = new Map(stageDefs.map((s) => [s.id, s.position] as const));
  const historyByAssoc = new Map<string, any[]>();
  for (const h of stageHistory) {
    if (!h.association_id) continue;
    const group = historyByAssoc.get(h.association_id) ?? [];
    group.push(h);
    historyByAssoc.set(h.association_id, group);
  }
  for (const [associationId, moves] of historyByAssoc.entries()) {
    moves.sort((a, b) => new Date(a.moved_at ?? 0).getTime() - new Date(b.moved_at ?? 0).getTime());
    historyByAssoc.set(associationId, moves);
  }

  // Measured stage entries: every recorded arrival plus each candidate's origin stage.
  const enteredByStage = new Map<string, number>(stageDefs.map((s) => [s.id, 0] as const));
  const bump = (stageId: string | null | undefined) => {
    if (!stageId || !enteredByStage.has(stageId)) return;
    enteredByStage.set(stageId, (enteredByStage.get(stageId) ?? 0) + 1);
  };
  for (const h of stageHistory) bump(h.to_stage_id);
  for (const a of list as any[]) {
    const moves = historyByAssoc.get(a.id) ?? [];
    const origin = moves.length ? moves[0].from_stage_id : a.current_stage_id;
    bump(origin);
  }

  // Rejections are attributed to the stage the candidate actually sat in when rejected.
  const rejectionStageOf = (a: any): string | null => {
    const rejectedAt = a.rejected_at ? new Date(a.rejected_at).getTime() : null;
    const moves = historyByAssoc.get(a.id) ?? [];
    if (rejectedAt != null) {
      let stageId: string | null = moves.length ? moves[0].from_stage_id ?? null : a.current_stage_id ?? null;
      for (const h of moves) {
        if (!h.moved_at || new Date(h.moved_at).getTime() > rejectedAt) break;
        stageId = h.to_stage_id ?? stageId;
      }
      if (stageId) return stageId;
    }
    return a.current_stage_id ?? null;
  };
  const rejectedByStageId = new Map<string, number>();
  for (const a of list as any[]) {
    if (a.status !== 'rejected') continue;
    const stageId = rejectionStageOf(a);
    if (!stageId) continue;
    rejectedByStageId.set(stageId, (rejectedByStageId.get(stageId) ?? 0) + 1);
  }

  const stageConversion = stageDefs.map((s) => {
    const advanced = stageHistory.filter((h) => h.from_stage_id === s.id && h.to_stage_id && h.to_stage_id !== s.id).length;
    const rejectedFromStage = rejectedByStageId.get(s.id) ?? 0;
    const entered = enteredByStage.get(s.id) ?? 0;
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
  for (const h of stageHistory) {
    if (h.moved_at && new Date(h.moved_at) >= new Date(fourteenAgo)) {
      const fromPos = h.from_stage_id ? stagePositionById.get(h.from_stage_id) : null;
      const toPos = h.to_stage_id ? stagePositionById.get(h.to_stage_id) : null;
      if (fromPos != null && toPos != null && toPos > fromPos) forwardMovesLast14d++;
    }
  }
  const assocById = new Map<string, any>((list as any[]).map((a) => [a.id, a] as const));
  for (const [associationId, moves] of historyByAssoc.entries()) {
    const assoc = assocById.get(associationId);
    let previous = assoc?.created_at ? new Date(assoc.created_at) : null;
    for (const h of moves) {
      if (previous && h.moved_at) moveDurations.push(daysBetween(previous, new Date(h.moved_at)));
      if (h.moved_at) previous = new Date(h.moved_at);
    }
  }


  // Composition --------------------------------------------------------------
  // Salary — candidate expectations normalised into the job's budget currency and period.
  const budgetCur = (job.budget_currency || 'MXN').toUpperCase();
  const budgetPer = (job.budget_period || 'monthly').toLowerCase();
  const rateMap = await loadCurrencyRates(client, job.tenant_id ?? null);
  const salaryValues: number[] = [];
  let salaryEligible = 0;
  let salaryConverted = 0;
  for (const a of list) {
    const c = (a as any).candidates;
    if (!c) continue;
    salaryEligible++;
    if (c.salary_amount == null) continue;
    const cur = String(c.salary_currency || '').toUpperCase() || budgetCur;
    const per = String(c.salary_period || '').toLowerCase() || budgetPer;
    const periodised = toPeriod(Number(c.salary_amount), per, budgetPer);
    if (periodised == null) continue;
    const converted = convertCurrency(periodised, cur, budgetCur, rateMap);
    if (converted == null) continue;
    if (cur !== budgetCur || per !== budgetPer) salaryConverted++;
    salaryValues.push(converted);
  }
  const salary = salaryValues.length > 0
    ? {
        data_points: salaryValues.length,
        converted_data_points: salaryConverted,
        basis: `${budgetCur} ${budgetPer}`,
        coverage_pct: salaryEligible ? salaryValues.length / salaryEligible : 0,
        median: median(salaryValues)!,
        p10: percentile(salaryValues, 10),
        p90: percentile(salaryValues, 90),
      }
    : null;

  // Location — primary plus additional locations, with work-mode awareness.
  const jobLocations = [job.location, ...((job.additional_locations ?? []) as string[])]
    .map(norm)
    .filter(Boolean);
  const remoteJob = job.location_requirement === 'remote' || norm(job.work_mode) === 'remote';
  let locDataPoints = 0, locInRange = 0;
  if (jobLocations.length > 0 || remoteJob) {
    for (const a of list) {
      const c = (a as any).candidates;
      if (!c) continue;
      const parts = [c.location_city, c.location_state, c.location_country].filter(Boolean).map(norm);
      if (parts.length === 0) continue;
      locDataPoints++;
      if (remoteJob) { locInRange++; continue; }
      const joined = parts.join(' ');
      const matches = jobLocations.some((loc) =>
        joined.includes(loc) || loc.split(/[,/]| - /).some((token) => {
          const t = token.trim();
          return t.length > 2 && joined.includes(t);
        }),
      );
      if (matches) locInRange++;
    }
  }
  const location = locDataPoints > 0
    ? {
        data_points: locDataPoints,
        in_range_pct: locInRange / locDataPoints,
        basis: remoteJob ? 'remote' : `${jobLocations.length} accepted location${jobLocations.length === 1 ? '' : 's'}`,
      }
    : null;

  // Skills — must-haves coverage, matched on normalised skill tokens (not exact strings).
  const musts: string[] = (job.must_have_skills ?? []).map((m: unknown) => String(m ?? '').trim()).filter(Boolean);
  let skills: JobSnapshot['composition']['skills'] = null;
  if (musts.length > 0) {
    const perSkillHits: Record<string, number> = {};
    musts.forEach((m: string) => { perSkillHits[m] = 0; });
    let skDataPoints = 0, allHaveAll = 0;
    for (const a of list) {
      const c = (a as any).candidates;
      if (!c) continue;
      const raw = [
        ...((c.standardized_skills ?? []) as string[]),
        ...((c.skills ?? []) as string[]),
      ].filter(Boolean).map((s) => skillKey(String(s)));
      const cs = new Set(raw.filter(Boolean));
      if (cs.size === 0) continue;
      skDataPoints++;
      let allHave = true;
      for (const m of musts) {
        if (skillMatches(m, cs)) perSkillHits[m]++;
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
  const scorecards: JobSnapshot['scorecards'] = {
    total: 0,
    submitted: 0,
    ai_drafts: 0,
    by_rating: {},
    by_stage: {},
    rated_score_questions: [],
    recent: [],
  };
  const { data: scorecardRows } = await client
    .from('job_stage_scorecards')
    .select('id, candidate_id, stage_instance_id, rating, general_overview, created_at, is_ai_draft')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(400);
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
    if (!sc.is_ai_draft) {
      const stageName = sc.stage_instance_id ? stageNameById.get(sc.stage_instance_id) ?? 'Unknown stage' : 'Unknown stage';
      const bucket = scorecards.by_stage[stageName] ?? { submitted: 0, by_rating: {} };
      bucket.submitted++;
      bucket.by_rating[rating] = (bucket.by_rating[rating] ?? 0) + 1;
      scorecards.by_stage[stageName] = bucket;
    }
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

  // Numeric scorecard answers, aggregated per question (no free text sent).
  const scorecardIds = (scorecardRows ?? []).map((sc: any) => sc.id).filter(Boolean);
  if (scorecardIds.length > 0) {
    let responses: any[] = [];
    for (let i = 0; i < scorecardIds.length; i += 300) {
      const chunk = scorecardIds.slice(i, i + 300);
      const { data } = await client
        .from('scorecard_question_responses')
        .select('question_id, answer_text')
        .in('scorecard_id', chunk);
      responses = responses.concat(data ?? []);
    }
    const questionIds = Array.from(new Set(responses.map((r) => r.question_id).filter(Boolean)));
    const questionById = new Map<string, { text: string; type: string }>();
    for (let i = 0; i < questionIds.length; i += 300) {
      const chunk = questionIds.slice(i, i + 300);
      const { data } = await client
        .from('scorecard_interview_questions')
        .select('id, question_text, answer_type')
        .in('id', chunk);
      for (const q of data ?? []) questionById.set(q.id, { text: q.question_text, type: String(q.answer_type ?? '') });
    }
    const numericByQuestion = new Map<string, number[]>();
    for (const r of responses) {
      const q = r.question_id ? questionById.get(r.question_id) : null;
      if (!q || !/score|rating/.test(q.type)) continue;
      const value = Number(String(r.answer_text ?? '').trim());
      if (!Number.isFinite(value)) continue;
      const values = numericByQuestion.get(q.text) ?? [];
      values.push(value);
      numericByQuestion.set(q.text, values);
    }
    scorecards.rated_score_questions = Array.from(numericByQuestion.entries())
      .map(([question, values]) => ({
        question: question.slice(0, 120),
        responses: values.length,
        average: Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100,
      }))
      .sort((a, b) => b.responses - a.responses)
      .slice(0, 8);
  }

  // Interviews ----------------------------------------------------------------
  const { data: bookingRows } = await client
    .from('scheduled_bookings')
    .select('scheduled_start, status, cancelled_at, rescheduled_at, candidate_confirmation_status')
    .eq('job_id', jobId);
  const interviews: JobSnapshot['interviews'] = {
    total: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
    rescheduled: 0,
    unconfirmed_upcoming: 0,
    recent_completed_14d: 0,
    next_scheduled_at: null,
  };
  for (const b of bookingRows ?? []) {
    interviews.total++;
    const start = b.scheduled_start ? new Date(b.scheduled_start) : null;
    const status = norm(b.status);
    if (b.rescheduled_at) interviews.rescheduled++;
    if (status === 'cancelled' || b.cancelled_at) interviews.cancelled++;
    else if (start && start > now) {
      interviews.upcoming++;
      if (norm(b.candidate_confirmation_status) !== 'confirmed') interviews.unconfirmed_upcoming++;
      if (!interviews.next_scheduled_at || start < new Date(interviews.next_scheduled_at)) {
        interviews.next_scheduled_at = start.toISOString();
      }
    } else if (start) {
      interviews.completed++;
      if (start >= new Date(fourteenAgo)) interviews.recent_completed_14d++;
    }
  }

  // Rejections ----------------------------------------------------------------
  const rejections: JobSnapshot['rejections'] = { total: rejectedCount, by_reason: {}, by_category: {}, by_stage: {} };
  for (const [stageId, count] of rejectedByStageId.entries()) {
    const name = stageNameById.get(stageId);
    if (name) rejections.by_stage[name] = count;
  }
  const reasonIds = Array.from(new Set((list as any[]).filter((a) => a.status === 'rejected' && a.rejection_reason_id).map((a) => a.rejection_reason_id)));
  if (reasonIds.length > 0) {
    const { data: reasonRows } = await client
      .from('rejection_reasons')
      .select('id, name, category')
      .in('id', reasonIds);
    const reasonById = new Map((reasonRows ?? []).map((r: any) => [r.id, r] as const));
    for (const a of list as any[]) {
      if (a.status !== 'rejected') continue;
      const reason = a.rejection_reason_id ? reasonById.get(a.rejection_reason_id) : null;
      const name = reason?.name ?? 'No reason recorded';
      rejections.by_reason[name] = (rejections.by_reason[name] ?? 0) + 1;
      const category = reason?.category ? String(reason.category) : 'unspecified';
      rejections.by_category[category] = (rejections.by_category[category] ?? 0) + 1;
    }
  } else if (rejectedCount > 0) {
    rejections.by_reason['No reason recorded'] = rejectedCount;
    rejections.by_category['unspecified'] = rejectedCount;
  }

  // Offers --------------------------------------------------------------------
  const offers: JobSnapshot['offers'] = { total: 0, drafts: 0, sent: 0, accepted: 0, declined: 0, approval_pending: 0, approval_blocked: 0 };
  const { data: offerRows } = await client
    .from('offer_letters')
    .select('id, status, sent_at')
    .eq('job_id', jobId);
  for (const o of offerRows ?? []) {
    offers.total++;
    const status = norm(o.status);
    if (status.includes('accept')) offers.accepted++;
    else if (status.includes('declin') || status.includes('reject')) offers.declined++;
    else if (status.includes('sent') || o.sent_at) offers.sent++;
    else offers.drafts++;
  }
  const { data: approvalRows } = await client
    .from('offer_approval_requests')
    .select('status')
    .eq('job_id', jobId);
  for (const r of approvalRows ?? []) {
    const status = norm(r.status);
    if (status.includes('pending') || status.includes('progress')) offers.approval_pending++;
    else if (status.includes('declin') || status.includes('reject') || status.includes('block')) offers.approval_blocked++;
  }

  // Communication -------------------------------------------------------------
  const communication: JobSnapshot['communication'] = {
    outbound_total: 0,
    inbound_total: 0,
    candidates_contacted: 0,
    replies: 0,
    reply_rate_pct: null,
    median_hours_to_first_reply: null,
    awaiting_reply_over_3d: 0,
    last_outbound_at: null,
  };
  const { data: emailRows } = await client
    .from('email_logs')
    .select('candidate_id, direction, sent_at, received_at, created_at')
    .eq('job_id', jobId)
    .not('candidate_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(4000);
  const firstOutbound = new Map<string, number>();
  const firstInboundAfter = new Map<string, number>();
  for (const e of emailRows ?? []) {
    const inbound = norm(e.direction) === 'inbound' || (!e.sent_at && !!e.received_at);
    const at = new Date(e.sent_at ?? e.received_at ?? e.created_at).getTime();
    if (!Number.isFinite(at)) continue;
    if (inbound) {
      communication.inbound_total++;
      const started = firstOutbound.get(e.candidate_id);
      if (started != null && at > started && !firstInboundAfter.has(e.candidate_id)) {
        firstInboundAfter.set(e.candidate_id, at);
      }
    } else {
      communication.outbound_total++;
      if (!firstOutbound.has(e.candidate_id)) firstOutbound.set(e.candidate_id, at);
      const iso = new Date(at).toISOString();
      if (!communication.last_outbound_at || iso > communication.last_outbound_at) communication.last_outbound_at = iso;
    }
  }
  communication.candidates_contacted = firstOutbound.size;
  communication.replies = firstInboundAfter.size;
  if (firstOutbound.size > 0) {
    communication.reply_rate_pct = Math.round((firstInboundAfter.size / firstOutbound.size) * 1000) / 10;
    const latencies: number[] = [];
    for (const [candidateId, started] of firstOutbound.entries()) {
      const replied = firstInboundAfter.get(candidateId);
      if (replied != null) latencies.push((replied - started) / 3_600_000);
      else if (now.getTime() - started > 3 * 86_400_000) communication.awaiting_reply_over_3d++;
    }
    const medianLatency = median(latencies);
    communication.median_hours_to_first_reply = medianLatency == null ? null : Math.round(medianLatency * 10) / 10;
  }

  // Reference checks ----------------------------------------------------------
  const references: JobSnapshot['references'] = { requests_total: 0, by_state: {} };
  const { data: referenceRows } = await client
    .from('reference_requests')
    .select('state')
    .eq('job_id', jobId);
  for (const r of referenceRows ?? []) {
    references.requests_total++;
    const state = String(r.state ?? 'unknown');
    references.by_state[state] = (references.by_state[state] ?? 0) + 1;
  }

  // Application funnel --------------------------------------------------------
  const funnel: JobSnapshot['funnel'] = {
    postings_total: 0,
    postings_active: 0,
    applications_total: inboundTotal,
    applications_last_30d: inboundLast30,
    by_board: {},
  };
  const { data: postingRows } = await client
    .from('job_postings')
    .select('id, is_active')
    .eq('job_id', jobId)
    .is('deleted_at', null);
  for (const p of postingRows ?? []) {
    funnel.postings_total++;
    if (p.is_active) funnel.postings_active++;
  }
  for (const a of list as any[]) {
    const board = a.candidates?.job_board_source;
    if (!board) continue;
    const label = String(board);
    funnel.by_board[label] = (funnel.by_board[label] ?? 0) + 1;
  }

  // Team ----------------------------------------------------------------------
  const team = { recruiters: 0, hiring_managers: 0, interviewers: 0, has_reports_to: !!job.reports_to_user_id, has_coordinator: !!job.coordinator_user_id };
  const { data: assignmentRows } = await client
    .from('job_assignments')
    .select('role')
    .eq('job_id', jobId)
    .is('deleted_at', null);
  for (const r of assignmentRows ?? []) {
    const role = norm(r.role);
    if (role === 'recruiter') team.recruiters++;
    else if (role === 'hiring_manager') team.hiring_managers++;
    else if (role === 'interviewer') team.interviewers++;
  }

  // Benchmarks and trend ------------------------------------------------------
  const benchmarks = await buildBenchmarks(client, job, jobId);
  const trend = await buildTrend(client, jobId, { activeCount, hiredCount, rejectedCount, forwardMovesLast14d });

  const snapshot: JobSnapshot = {
    job: {
      id: job.id,
      title: job.title,
      status: job.status,
      days_open: daysOpen,
      priority: job.priority ?? null,
      work_mode: job.work_mode ?? null,
      employment_type: job.employment_type ?? null,
      job_level: job.job_level ?? null,
      years_experience: (job.min_years_experience != null || job.max_years_experience != null)
        ? { min: job.min_years_experience ?? null, max: job.max_years_experience ?? null }
        : null,
      location: job.location ?? null,
      additional_locations: (job.additional_locations ?? []) as string[],
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
      team,
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
      active_inbound_total: activeInboundTotal,
      active_sourced_total: activeSourcedTotal,
      active_unknown_source_total: activeUnknownSourceTotal,
      source_breakdown: pipelineSourceBreakdown,
      source_labels: pipelineSourceLabels,
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
    rejections,
    offers,
    communication,
    references,
    funnel,
    benchmarks,
    trend,
  };


  // Hash excludes timestamps and the trend block (they move without the job changing).
  const hashInput = JSON.parse(JSON.stringify(snapshot));
  delete hashInput.pipeline.last_activity_at;
  delete hashInput.trend;
  return { snapshot, snapshot_hash: stableHash(hashInput) };
}

// Peer jobs of the same level in the same tenant give the model a reference point.
async function buildBenchmarks(
  client: SupabaseClient,
  job: any,
  jobId: string,
): Promise<JobSnapshot['benchmarks']> {
  if (!job.tenant_id) return null;
  let query = client
    .from('jobs')
    .select('id, created_at, status, job_level')
    .eq('tenant_id', job.tenant_id)
    .neq('id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(25);
  if (job.job_level) query = query.eq('job_level', job.job_level);
  const { data: peers } = await query;
  const peerJobs = peers ?? [];
  if (peerJobs.length === 0) return null;

  const peerIds = peerJobs.map((p: any) => p.id);
  const { data: peerAssocs } = await client
    .from('job_candidate_associations')
    .select('job_id, status, created_at, hired_at')
    .in('job_id', peerIds)
    .limit(5000);

  const now = new Date();
  const daysToHire: number[] = [];
  const activePerJob = new Map<string, number>();
  let hired = 0;
  let closedOut = 0;
  for (const a of peerAssocs ?? []) {
    const status = norm(a.status);
    if (status === 'hired') {
      hired++;
      closedOut++;
      if (a.hired_at) daysToHire.push(daysBetween(new Date(a.created_at), new Date(a.hired_at)));
    } else if (status === 'rejected' || status === 'withdrawn') {
      closedOut++;
    } else {
      activePerJob.set(a.job_id, (activePerJob.get(a.job_id) ?? 0) + 1);
    }
  }
  const openAges = peerJobs
    .filter((p: any) => norm(p.status) === 'open')
    .map((p: any) => daysBetween(new Date(p.created_at), now));

  return {
    comparable_jobs: peerJobs.length,
    basis: job.job_level ? `same level (${job.job_level}) in this workspace` : 'other jobs in this workspace',
    median_days_to_hire: median(daysToHire),
    median_days_open_active: median(openAges),
    median_active_per_job: median(peerJobs.map((p: any) => activePerJob.get(p.id) ?? 0)),
    hire_rate_pct: closedOut > 0 ? Math.round((hired / closedOut) * 1000) / 10 : null,
  };
}

// Movement since the previous briefing, so the model can talk about change.
async function buildTrend(
  client: SupabaseClient,
  jobId: string,
  current: { activeCount: number; hiredCount: number; rejectedCount: number; forwardMovesLast14d: number },
): Promise<JobSnapshot['trend']> {
  const { data } = await client
    .from('job_briefings')
    .select('snapshot, generated_at')
    .eq('job_id', jobId)
    .maybeSingle();
  const previous = (data as any)?.snapshot;
  if (!previous?.pipeline || !data?.generated_at) return null;
  const since = new Date(data.generated_at);
  const daysSince = daysBetween(since, new Date());
  if (daysSince < 1) return null;
  const prevForward = previous.velocity?.forward_moves_last_14d;
  return {
    since: since.toISOString(),
    days_since: daysSince,
    active_delta: current.activeCount - (previous.pipeline.active_count ?? 0),
    hired_delta: current.hiredCount - (previous.pipeline.hired_count ?? 0),
    rejected_delta: current.rejectedCount - (previous.pipeline.rejected_count ?? 0),
    forward_moves_last_14d_delta:
      typeof prevForward === 'number' ? current.forwardMovesLast14d - prevForward : null,
  };
}

// Re-export for callers that don't want their own client wiring.
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}
