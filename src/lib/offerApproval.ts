// Single source of truth for the offer approval chain: conditions, run status
// derivation and the canMarkHired rule. Read this from every surface so the
// banner, the sidebar and the approvals view can never disagree.

export type ApprovalCondition = 'always' | 'above_band' | 'equity' | 'senior_plus'

export const CONDITION_OPTIONS: Array<{
  value: ApprovalCondition
  chipLabel: string
  menuLabel: string
}> = [
  { value: 'always', chipLabel: 'Always', menuLabel: 'Always required' },
  { value: 'above_band', chipLabel: 'Above band', menuLabel: 'Only if above the posted band' },
  { value: 'equity', chipLabel: 'Equity offers', menuLabel: 'Only if equity is included' },
  { value: 'senior_plus', chipLabel: 'Senior+', menuLabel: 'Only for Senior+ levels' },
]

export function conditionChipLabel(condition?: string | null): string {
  return CONDITION_OPTIONS.find((c) => c.value === condition)?.chipLabel || 'Always'
}

export const SKIP_REASON: Record<Exclude<ApprovalCondition, 'always'>, string> = {
  above_band: 'Not required · offer is within the posted band',
  equity: 'Not required · no equity in this offer',
  senior_plus: 'Not required · role is below Senior',
}

const SENIOR_PLUS_LEVELS = ['senior', 'lead', 'principal', 'director', 'vp', 'c_level', 'executive']

export interface OfferConditionContext {
  baseSalary?: number | null
  postedMax?: number | null
  hasEquity?: boolean
  jobLevel?: string | null
}

/** Evaluate a condition against an offer. Non-applying steps become `skipped`. */
export function resolveCondition(
  condition: string | null | undefined,
  ctx: OfferConditionContext
): { applies: boolean; skipReason: string | null } {
  const c = (condition || 'always') as ApprovalCondition
  if (c === 'always') return { applies: true, skipReason: null }

  if (c === 'above_band') {
    const applies =
      typeof ctx.baseSalary === 'number' &&
      typeof ctx.postedMax === 'number' &&
      ctx.postedMax > 0 &&
      ctx.baseSalary > ctx.postedMax
    return { applies, skipReason: applies ? null : SKIP_REASON.above_band }
  }

  if (c === 'equity') {
    const applies = !!ctx.hasEquity
    return { applies, skipReason: applies ? null : SKIP_REASON.equity }
  }

  const level = (ctx.jobLevel || '').toLowerCase().replace(/[\s-]/g, '_')
  const applies = SENIOR_PLUS_LEVELS.some((l) => level.includes(l))
  return { applies, skipReason: applies ? null : SKIP_REASON.senior_plus }
}

export type ApprovalMode = 'sequential' | 'parallel'
export type RunStepStatus = 'approved' | 'awaiting' | 'queued' | 'skipped' | 'declined'

export interface ApprovalRules {
  remind24h: boolean
  autoEscalate: boolean
  adminOverride: boolean
  notifyChain: boolean
}

export const DEFAULT_APPROVAL_RULES: ApprovalRules = {
  remind24h: true,
  autoEscalate: false,
  adminOverride: true,
  notifyChain: true,
}

export function normalizeRules(raw: any): ApprovalRules {
  return { ...DEFAULT_APPROVAL_RULES, ...(raw && typeof raw === 'object' ? raw : {}) }
}

interface RawRunStep {
  status: string
  step_order: number
}

/**
 * Map the persisted step status onto the display status of the run.
 * sequential → the first non-skipped pending step is `awaiting`, the rest `queued`.
 * parallel   → every non-skipped pending step is `awaiting`.
 */
export function deriveRunStatuses<T extends RawRunStep>(
  steps: T[],
  mode: ApprovalMode
): Array<T & { runStatus: RunStepStatus }> {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order)
  const declined = ordered.some((s) => s.status === 'declined')
  const firstPending = ordered.find((s) => s.status === 'pending' || s.status === 'recalled')

  return ordered.map((s) => {
    let runStatus: RunStepStatus
    if (s.status === 'approved') runStatus = 'approved'
    else if (s.status === 'skipped') runStatus = 'skipped'
    else if (s.status === 'declined') runStatus = 'declined'
    else if (declined) runStatus = 'queued'
    else if (mode === 'parallel') runStatus = 'awaiting'
    else runStatus = s === firstPending ? 'awaiting' : 'queued'
    return { ...s, runStatus }
  })
}

export function runCounts(steps: Array<{ status: string }>) {
  const active = steps.filter((s) => s.status !== 'skipped')
  const approved = active.filter((s) => s.status === 'approved').length
  return { approved, total: active.length }
}

/**
 * THE rule. Enabled with no chain the moment a draft offer exists; with a chain,
 * only when every non-skipped step is approved.
 */
export function canMarkHired(input: {
  offerExists: boolean
  required: boolean
  approverCount: number
  runSteps: Array<{ status: string }> | null | undefined
}): boolean {
  if (!input.offerExists) return false
  if (!input.required || input.approverCount === 0) return true
  const steps = input.runSteps || []
  if (steps.length === 0) return false
  return steps.every((s) => s.status === 'approved' || s.status === 'skipped')
}
