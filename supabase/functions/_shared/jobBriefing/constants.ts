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
