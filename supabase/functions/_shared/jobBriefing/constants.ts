// Single source of truth for all detector thresholds.
// Tune here — no magic numbers in detectors.ts.

export const THRESHOLDS = {
  // D1 · stalled_near_offer
  stalledNearOffer: {
    maxDistanceToOffer: 2,     // stages within 2 of offer
    daysInStage: 7,            // > 7 days waiting
    evidenceLimit: 5,
  },

  // D2 · dead_posting
  deadPosting: {
    minDaysOpen: 21,           // grace period — no fire before
    escalateDaysOpen: 45,      // critical above this if no inbound ever
  },

  // D3 · salary_misalignment
  salary: {
    overBudgetRatio: 1.10,     // median > budget.max * 1.10 → fires (a)
    spreadRatio: 1.8,          // p90/p10 ≥ 1.8 → fires (b)
    minDataPoints: 4,
    minCoveragePct: 0.4,
  },

  // D4 · thin_pipeline
  thinPipeline: {
    minActivePreInterview: 3,
    graceDays: 7,
  },

  // D5 · no_activity
  noActivity: {
    windowDays: 7,
  },

  // P1 · fast_decisions
  fastDecisions: {
    maxMedianDaysToRejection: 3,
    minRejections: 4,
  },

  // D6 · offer_stuck
  offerStuck: {
    minPendingApprovals: 1,
  },

  // D7 · outreach_not_landing
  outreach: {
    minContacted: 8,
    maxReplyRatePct: 20,
    minAwaitingOver3d: 5,
  },

  // D8 · interview_reliability
  interviewReliability: {
    minInterviews: 5,
    maxDisruptionPct: 30,       // (cancelled + rescheduled) / total
    minUnconfirmedUpcoming: 3,
  },

  // D9 · rejection_concentration
  rejectionConcentration: {
    minRejections: 6,
    dominantSharePct: 50,
  },

  // P2 · ahead_of_benchmark
  benchmark: {
    minComparableJobs: 3,
    activeLeadRatio: 1.5,       // active per job vs peer median
  },
} as const;

// Stage types considered "pre-interview" for D4.
export const PRE_INTERVIEW_STAGE_TYPES = new Set([
  'application',
  'application_review',
  'screening',
  'assessment',
  'reference_check',
]);

// Stage types that count as terminal-positive (reached offer territory).
export const OFFER_STAGE_TYPES = new Set(['offer', 'onboarding']);

// Statuses that exclude a candidate from the active pipeline.
export const TERMINAL_STATUSES = new Set(['rejected', 'withdrawn', 'hired']);
