/**
 * Reference checks — SINGLE source of truth for state derivation and counts.
 *
 * Every surface (status pill, referee track, module list, tabs, filters, counts)
 * must import from here. Never re-implement any of this logic locally, and never
 * express reference progress as a percentage.
 */

/** Request state. 'none' is UI-only: no request exists. Not a database value. */
export type RefRequestState =
  | 'none'
  | 'draft'
  | 'candidate'
  | 'referees'
  | 'partial'
  | 'complete'
  | 'attention'
  | 'expired'
  | 'cancelled'

export type RefereeStatus =
  | 'pending'
  | 'invited'
  | 'opened'
  | 'in_progress'
  | 'submitted'
  | 'declined'
  | 'bounced'
  | 'on_hold'
  | 'logged'

export interface RefereeLike {
  id?: string
  status: RefereeStatus
  on_hold?: boolean | null
  submitted_at?: string | null
}

export interface RefCounts {
  /** Referees counted toward the requirement (on-hold excluded). */
  total: number
  submitted: number
  bounced: number
  declined: number
  onHold: number
  inProgress: number
  required: number
}

const isOnHold = (r: RefereeLike) => r.on_hold === true || r.status === 'on_hold'
/** 'logged' counts as submitted (recruiter captured the reference manually). */
const isSubmitted = (r: RefereeLike) => r.status === 'submitted' || r.status === 'logged'
const isFailed = (r: RefereeLike) => r.status === 'bounced' || r.status === 'declined'

/** Raw counts. On-hold referees are excluded from the denominator — they are not failures. */
export function countReferees(referees: RefereeLike[], requiredCount: number): RefCounts {
  const active = referees.filter((r) => !isOnHold(r))
  return {
    total: active.length,
    submitted: active.filter(isSubmitted).length,
    bounced: referees.filter((r) => !isOnHold(r) && r.status === 'bounced').length,
    declined: referees.filter((r) => !isOnHold(r) && r.status === 'declined').length,
    onHold: referees.filter(isOnHold).length,
    inProgress: active.filter((r) => r.status === 'opened' || r.status === 'in_progress').length,
    required: Math.max(0, requiredCount),
  }
}

/**
 * Derive the request state from its referees.
 *  - 'attention' when any referee bounced/declined AND the minimum can no longer
 *    be met without action
 *  - 'complete' when submitted >= required
 *  - 'partial' when >=1 submitted but below required
 *  - 'referees' when referees exist but none submitted yet
 */
export function deriveState(referees: RefereeLike[], requiredCount: number): RefRequestState {
  const c = countReferees(referees, requiredCount)

  if (referees.length === 0) return 'candidate'

  if (c.submitted >= c.required && c.required > 0) return 'complete'

  const reachable = c.total - c.bounced - c.declined
  const hasFailures = referees.some((r) => !isOnHold(r) && isFailed(r))
  if (hasFailures && reachable < c.required) return 'attention'

  if (c.submitted >= 1) return 'partial'
  return 'referees'
}

export const REF_STATE_LABEL: Record<RefRequestState, string> = {
  none: 'No reference check',
  draft: 'Draft',
  candidate: 'Waiting on candidate',
  referees: 'Waiting on referees',
  partial: 'Partially complete',
  complete: 'Complete',
  attention: 'Needs attention',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export type RefTone = 'green' | 'red' | 'yellow' | 'orange' | 'blue' | 'purple' | 'neutral'

export const REF_STATE_TONE: Record<RefRequestState, RefTone> = {
  none: 'neutral',
  draft: 'neutral',
  candidate: 'blue',
  referees: 'blue',
  partial: 'yellow',
  complete: 'green',
  attention: 'red',
  expired: 'neutral',
  cancelled: 'neutral',
}

/** Never a percentage. e.g. "2 of 3 submitted · 1 bounced · 1 on hold" */
export function formatCounts(referees: RefereeLike[], requiredCount: number): string {
  const c = countReferees(referees, requiredCount)
  const parts = [`${c.submitted} of ${c.total} submitted`]
  if (c.bounced > 0) parts.push(`${c.bounced} bounced`)
  if (c.declined > 0) parts.push(`${c.declined} declined`)
  if (c.onHold > 0) parts.push(`${c.onHold} on hold`)
  return parts.join(' · ')
}

/* ------------------------------------------------------------------ */
/* List bucket predicates — a tab's filter AND its count use the same */
/* predicate. Never two code paths.                                    */
/* ------------------------------------------------------------------ */

export interface RefRequestLike {
  state: RefRequestState
  flagged?: boolean | null
}

export type RefBucket = 'all' | 'needsAttention' | 'waiting' | 'complete'

export const refPredicates: Record<RefBucket, (r: RefRequestLike) => boolean> = {
  all: () => true,
  needsAttention: (r) => r.state === 'attention' || r.state === 'expired' || r.flagged === true,
  waiting: (r) =>
    r.state === 'draft' || r.state === 'candidate' || r.state === 'referees' || r.state === 'partial',
  complete: (r) => r.state === 'complete',
}

export function countBucket<T extends RefRequestLike>(rows: T[], bucket: RefBucket): number {
  return rows.filter(refPredicates[bucket]).length
}

export function filterBucket<T extends RefRequestLike>(rows: T[], bucket: RefBucket): T[] {
  return rows.filter(refPredicates[bucket])
}

/** Referee status → track segment tone. */
export const REFEREE_STATUS_TONE: Record<RefereeStatus, RefTone> = {
  pending: 'neutral',
  invited: 'blue',
  opened: 'blue',
  in_progress: 'purple',
  submitted: 'green',
  logged: 'green',
  declined: 'red',
  bounced: 'red',
  on_hold: 'yellow',
}

export const REFEREE_STATUS_LABEL: Record<RefereeStatus, string> = {
  pending: 'Pending',
  invited: 'Invited',
  opened: 'Opened',
  in_progress: 'In progress',
  submitted: 'Submitted',
  logged: 'Logged by recruiter',
  declined: 'Declined',
  bounced: 'Bounced',
  on_hold: 'On hold',
}
