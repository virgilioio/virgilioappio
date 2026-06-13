// Deterministic detectors evaluated against a JobSnapshot.
// Each detector returns null (not fired) or a Finding.
// All thresholds come from ./constants.ts — no magic numbers here.

import type { JobSnapshot } from './snapshot.ts';
import { THRESHOLDS, PRE_INTERVIEW_STAGE_TYPES, OFFER_STAGE_TYPES } from './constants.ts';

export type Severity = 'critical' | 'warning' | 'positive';

export type Action = { label: string; prompt: string };

export type Finding = {
  id: string;
  severity: Severity;
  evidence: Record<string, unknown>;
  actions: Action[];
};

export type HealthStatus = {
  status: 'stalled' | 'at_risk' | 'on_track' | 'ramping_up';
  label: string;
};

// --- D1 · stalled_near_offer ----------------------------------------------
function d1_stalledNearOffer(s: JobSnapshot): Finding | null {
  const { maxDistanceToOffer, daysInStage, evidenceLimit } = THRESHOLDS.stalledNearOffer;
  const offers = s.pipeline.stages_from_offer;
  const stalled: Array<{ name: string; stage: string; days_in_stage: number }> = [];
  for (const st of s.pipeline.stages) {
    if (OFFER_STAGE_TYPES.has(st.stage_type)) continue; // skip those already in offer/onboarding
    const distance = offers[st.stage] ?? 99;
    if (distance > maxDistanceToOffer) continue;
    for (const c of st.candidates) {
      if (c.days_in_stage > daysInStage) {
        stalled.push({ name: c.name, stage: st.stage, days_in_stage: c.days_in_stage });
      }
    }
  }
  if (stalled.length === 0) return null;
  stalled.sort((a, b) => b.days_in_stage - a.days_in_stage);
  const top = stalled.slice(0, evidenceLimit);
  const stage = top[0].stage;
  const title = s.job.title;
  return {
    id: 'stalled_near_offer',
    severity: 'critical',
    evidence: { candidates: top, total: stalled.length, near_offer_stage: stage },
    actions: [
      { label: 'Review the candidates', prompt: `Show me the candidates waiting in ${stage} for ${title} and summarize their scorecards` },
      { label: 'Draft a nudge to the hiring manager', prompt: `Draft a follow-up to the hiring manager about the ${stalled.length} candidates waiting in ${stage} for ${title}` },
    ],
  };
}

// --- D2 · dead_posting -----------------------------------------------------
function d2_deadPosting(s: JobSnapshot): Finding | null {
  const { minDaysOpen, escalateDaysOpen } = THRESHOLDS.deadPosting;
  if (s.job.days_open < minDaysOpen) return null;
  if (s.pipeline.inbound_last_30d > 0) return null;
  const escalate = s.job.days_open >= escalateDaysOpen && s.pipeline.inbound_total === 0;
  const title = s.job.title;
  return {
    id: 'dead_posting',
    severity: escalate ? 'critical' : 'warning',
    evidence: {
      days_open: s.job.days_open,
      inbound_total: s.pipeline.inbound_total,
      sourced_total: s.pipeline.sourced_total,
    },
    actions: [
      { label: 'Diagnose the posting', prompt: `Diagnose why the ${title} posting has zero applications and suggest fixes` },
      { label: 'Expand distribution', prompt: `Where else can we publish the ${title} posting to get inbound applicants?` },
    ],
  };
}

// --- D3 · salary_misalignment ---------------------------------------------
function d3_salary(s: JobSnapshot): Finding | null {
  const { overBudgetRatio, spreadRatio, minDataPoints, minCoveragePct } = THRESHOLDS.salary;
  const sal = s.composition.salary;
  if (!sal) return null;
  if (sal.data_points < minDataPoints) return null;
  if (sal.coverage_pct < minCoveragePct) return null;

  const title = s.job.title;
  const budget = s.job.budget;

  // (a) Over budget
  if (budget?.max != null && sal.median > budget.max * overBudgetRatio) {
    return {
      id: 'salary_misalignment',
      severity: 'warning',
      evidence: {
        mode: 'over_budget',
        median: sal.median,
        p10: sal.p10,
        p90: sal.p90,
        spread_ratio: sal.p10 > 0 ? sal.p90 / sal.p10 : null,
        budget,
      },
      actions: [
        { label: 'Model a budget increase', prompt: `What happens to ${title}'s fill prospects if we raise the budget to match the pipeline median?` },
        { label: 'See distribution', prompt: `Show the salary distribution for ${title} candidates against the budget band` },
      ],
    };
  }

  // (b) Incoherent pipeline — only when no budget is set
  if (!budget && sal.p10 > 0 && sal.p90 / sal.p10 >= spreadRatio) {
    return {
      id: 'salary_misalignment',
      severity: 'warning',
      evidence: {
        mode: 'incoherent_pipeline',
        median: sal.median,
        p10: sal.p10,
        p90: sal.p90,
        spread_ratio: sal.p90 / sal.p10,
        budget: null,
      },
      actions: [
        { label: 'Set the budget band', prompt: `Help me set a salary band for ${title} based on the pipeline salary data` },
        { label: 'See distribution', prompt: `Show the salary distribution for ${title} candidates against the budget band` },
      ],
    };
  }

  return null;
}

// --- D4 · thin_pipeline ----------------------------------------------------
function d4_thinPipeline(s: JobSnapshot): Finding | null {
  const { minActivePreInterview, graceDays } = THRESHOLDS.thinPipeline;
  if (s.job.days_open < graceDays) return null;
  const offerStages = new Set(
    s.pipeline.stages.filter((st) => OFFER_STAGE_TYPES.has(st.stage_type)).map((st) => st.stage),
  );
  const hasOffer = s.pipeline.stages.some((st) => offerStages.has(st.stage) && st.active_count > 0);
  if (hasOffer) return null;
  const activePre = s.pipeline.stages
    .filter((st) => PRE_INTERVIEW_STAGE_TYPES.has(st.stage_type))
    .reduce((sum, st) => sum + st.active_count, 0);
  if (activePre >= minActivePreInterview) return null;
  const title = s.job.title;
  return {
    id: 'thin_pipeline',
    severity: 'warning',
    evidence: { active_pre_interview: activePre, active_total: s.pipeline.active_count },
    actions: [
      { label: 'Source more candidates', prompt: `Help me source more candidates for ${title}` },
      { label: 'Loosen requirements', prompt: `Which must-have requirements for ${title} are filtering out the most candidates?` },
    ],
  };
}

// --- D5 · no_activity ------------------------------------------------------
function d5_noActivity(s: JobSnapshot, d1Fired: boolean): Finding | null {
  if (s.job.status !== 'active' && s.job.status !== 'open') {
    // be tolerant about exact label
  }
  if (d1Fired) return null; // D1 already explains the stall more precisely
  if (s.velocity.transitions_last_7d > 0) return null;
  const title = s.job.title;
  const lastActivity = s.pipeline.last_activity_at ? new Date(s.pipeline.last_activity_at) : null;
  const days = lastActivity
    ? Math.max(0, Math.floor((Date.now() - lastActivity.getTime()) / 86_400_000))
    : s.job.days_open;
  if (s.pipeline.active_count === 0) {
    return {
      id: 'no_activity',
      severity: 'critical',
      evidence: { variant: 'empty_pipeline', days_since_last_activity: days, active_count: 0 },
      actions: [{ label: "What's stuck?", prompt: `Walk me through every active candidate on ${title} and what their next step is` }],
    };
  }
  return {
    id: 'no_activity',
    severity: 'critical',
    evidence: { variant: 'no_transitions', days_since_last_activity: days, active_count: s.pipeline.active_count },
    actions: [{ label: "What's stuck?", prompt: `Walk me through every active candidate on ${title} and what their next step is` }],
  };
}

// --- P1 · fast_decisions ---------------------------------------------------
function p1_fastDecisions(s: JobSnapshot): Finding | null {
  const { maxMedianDaysToRejection, minRejections } = THRESHOLDS.fastDecisions;
  if (s.pipeline.rejected_count < minRejections) return null;
  const m = s.velocity.median_days_to_rejection;
  if (m == null || m > maxMedianDaysToRejection) return null;
  return {
    id: 'fast_decisions',
    severity: 'positive',
    evidence: { median_days_to_rejection: m, rejections: s.pipeline.rejected_count },
    actions: [],
  };
}

// --- Public API ------------------------------------------------------------
export function evaluateDetectors(s: JobSnapshot): Finding[] {
  const findings: Finding[] = [];
  const d1 = d1_stalledNearOffer(s); if (d1) findings.push(d1);
  const d2 = d2_deadPosting(s);      if (d2) findings.push(d2);
  const d3 = d3_salary(s);           if (d3) findings.push(d3);
  const d4 = d4_thinPipeline(s);     if (d4) findings.push(d4);
  const d5 = d5_noActivity(s, !!d1); if (d5) findings.push(d5);
  const p1 = p1_fastDecisions(s);    if (p1) findings.push(p1);
  return findings;
}

export function deriveHealth(s: JobSnapshot, findings: Finding[]): HealthStatus {
  const criticals = findings.filter((f) => f.severity === 'critical');
  const warnings  = findings.filter((f) => f.severity === 'warning');

  // Ramping-up: new job, no detectors fired
  if (s.job.days_open < 7 && criticals.length === 0 && warnings.length === 0) {
    return { status: 'ramping_up', label: 'Ramping up' };
  }

  if (criticals.length > 0) {
    const top = criticals[0];
    const reasonMap: Record<string, string> = {
      stalled_near_offer: 'final review',
      dead_posting: 'no inbound',
      no_activity: 'no activity',
    };
    const reason = reasonMap[top.id] ?? top.id.replace(/_/g, ' ');
    return { status: 'stalled', label: `Stalled — ${reason}` };
  }
  if (warnings.length > 0) return { status: 'at_risk', label: 'At risk' };
  return { status: 'on_track', label: 'On track' };
}
