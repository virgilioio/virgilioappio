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
  const activeBeyondPreInterview = s.pipeline.stages
    .filter((st) => !PRE_INTERVIEW_STAGE_TYPES.has(st.stage_type) && !OFFER_STAGE_TYPES.has(st.stage_type))
    .reduce((sum, st) => sum + st.active_count, 0);
  if (activeBeyondPreInterview > 0 && s.pipeline.active_count >= minActivePreInterview) return null;
  if (s.velocity.forward_moves_last_14d > 0 && s.pipeline.active_count >= minActivePreInterview) return null;
  const activePre = s.pipeline.stages
    .filter((st) => PRE_INTERVIEW_STAGE_TYPES.has(st.stage_type))
    .reduce((sum, st) => sum + st.active_count, 0);
  if (activePre >= minActivePreInterview) return null;
  const title = s.job.title;
  return {
    id: 'thin_pipeline',
    severity: 'warning',
    evidence: {
      active_pre_interview: activePre,
      active_total: s.pipeline.active_count,
      active_beyond_pre_interview: activeBeyondPreInterview,
      forward_moves_last_14d: s.velocity.forward_moves_last_14d,
    },
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
  const recentScorecards = s.scorecards.recent.filter((sc) => {
    const createdAt = sc.created_at ? new Date(sc.created_at) : null;
    return createdAt && Date.now() - createdAt.getTime() <= 7 * 86_400_000;
  }).length;
  if (recentScorecards > 0 || s.interviews.upcoming > 0 || s.interviews.recent_completed_14d > 0) return null;
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

// --- D6 · offer_stuck ------------------------------------------------------
function d6_offerStuck(s: JobSnapshot): Finding | null {
  const { minPendingApprovals } = THRESHOLDS.offerStuck;
  const o = s.offers;
  const blocked = o.approval_blocked > 0;
  const pending = o.approval_pending >= minPendingApprovals;
  if (!blocked && !pending) return null;
  const title = s.job.title;
  return {
    id: 'offer_stuck',
    severity: blocked ? 'critical' : 'warning',
    evidence: {
      approval_pending: o.approval_pending,
      approval_blocked: o.approval_blocked,
      offers_sent: o.sent,
      offers_accepted: o.accepted,
      offers_declined: o.declined,
    },
    actions: [
      { label: 'Show the approval state', prompt: `Who still has to approve the open offers on ${title}, and how long have they been waiting?` },
      { label: 'Draft an approval nudge', prompt: `Draft a short nudge to the pending offer approvers on ${title}` },
    ],
  };
}

// --- D7 · outreach_not_landing --------------------------------------------
function d7_outreach(s: JobSnapshot): Finding | null {
  const { minContacted, maxReplyRatePct, minAwaitingOver3d } = THRESHOLDS.outreach;
  const c = s.communication;
  if (c.candidates_contacted < minContacted) return null;
  const lowReply = c.reply_rate_pct != null && c.reply_rate_pct <= maxReplyRatePct;
  const waiting = c.awaiting_reply_over_3d >= minAwaitingOver3d;
  if (!lowReply && !waiting) return null;
  const title = s.job.title;
  return {
    id: 'outreach_not_landing',
    severity: 'warning',
    evidence: {
      candidates_contacted: c.candidates_contacted,
      replies: c.replies,
      reply_rate_pct: c.reply_rate_pct,
      awaiting_reply_over_3d: c.awaiting_reply_over_3d,
      median_hours_to_first_reply: c.median_hours_to_first_reply,
    },
    actions: [
      { label: 'Improve the outreach', prompt: `Our outreach for ${title} is getting few replies — rewrite the message to get more responses` },
      { label: 'Show who never replied', prompt: `Which ${title} candidates were contacted and never replied?` },
    ],
  };
}

// --- D8 · interview_reliability -------------------------------------------
function d8_interviewReliability(s: JobSnapshot): Finding | null {
  const { minInterviews, maxDisruptionPct, minUnconfirmedUpcoming } = THRESHOLDS.interviewReliability;
  const i = s.interviews;
  const disruptionPct = i.total > 0 ? ((i.cancelled + i.rescheduled) / i.total) * 100 : 0;
  const disrupted = i.total >= minInterviews && disruptionPct >= maxDisruptionPct;
  const unconfirmed = i.unconfirmed_upcoming >= minUnconfirmedUpcoming;
  if (!disrupted && !unconfirmed) return null;
  const title = s.job.title;
  return {
    id: 'interview_reliability',
    severity: 'warning',
    evidence: {
      total: i.total,
      cancelled: i.cancelled,
      rescheduled: i.rescheduled,
      disruption_pct: Math.round(disruptionPct * 10) / 10,
      unconfirmed_upcoming: i.unconfirmed_upcoming,
      next_scheduled_at: i.next_scheduled_at,
    },
    actions: [
      { label: 'Review the schedule', prompt: `Show the interview schedule for ${title}, including cancellations and unconfirmed slots` },
      { label: 'Chase confirmations', prompt: `Draft a confirmation reminder for the upcoming ${title} interviews` },
    ],
  };
}

// --- D9 · rejection_concentration -----------------------------------------
function d9_rejectionConcentration(s: JobSnapshot): Finding | null {
  const { minRejections, dominantSharePct } = THRESHOLDS.rejectionConcentration;
  const r = s.rejections;
  if (r.total < minRejections) return null;
  const entries = Object.entries(r.by_reason).filter(([reason]) => reason !== 'No reason recorded');
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [reason, count] = entries[0];
  const sharePct = (count / r.total) * 100;
  if (sharePct < dominantSharePct) return null;
  const title = s.job.title;
  return {
    id: 'rejection_concentration',
    severity: 'warning',
    evidence: {
      dominant_reason: reason,
      count,
      share_pct: Math.round(sharePct * 10) / 10,
      total_rejections: r.total,
      by_stage: r.by_stage,
    },
    actions: [
      { label: 'Fix the filter upstream', prompt: `Most ${title} rejections are "${reason}" — how should we change sourcing or screening?` },
      { label: 'See the rejected candidates', prompt: `Show the ${title} candidates rejected for "${reason}"` },
    ],
  };
}

// --- P2 · ahead_of_benchmark ----------------------------------------------
function p2_benchmark(s: JobSnapshot): Finding | null {
  const { minComparableJobs, activeLeadRatio } = THRESHOLDS.benchmark;
  const b = s.benchmarks;
  if (!b || b.comparable_jobs < minComparableJobs) return null;
  if (b.median_active_per_job == null || b.median_active_per_job <= 0) return null;
  if (s.pipeline.active_count < b.median_active_per_job * activeLeadRatio) return null;
  return {
    id: 'ahead_of_benchmark',
    severity: 'positive',
    evidence: {
      active_count: s.pipeline.active_count,
      peer_median_active: b.median_active_per_job,
      comparable_jobs: b.comparable_jobs,
      basis: b.basis,
    },
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
  const d6 = d6_offerStuck(s);       if (d6) findings.push(d6);
  const d7 = d7_outreach(s);         if (d7) findings.push(d7);
  const d8 = d8_interviewReliability(s); if (d8) findings.push(d8);
  const d9 = d9_rejectionConcentration(s); if (d9) findings.push(d9);
  const p1 = p1_fastDecisions(s);    if (p1) findings.push(p1);
  const p2 = p2_benchmark(s);        if (p2) findings.push(p2);
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
