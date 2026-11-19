/**
 * What the dashboard queue's buttons do (Allan, 2026-11-14). Each is the same
 * change the rest of the app makes for that action, so the queue never has rules
 * of its own: moving a stage checks the scorecard rule (checkScorecardGate) and
 * writes what usePipelineActions.moveAssociationToStage writes; approving an offer
 * is offer_approval_decide, as on the Offer tab.
 */
import { supabase } from '@/lib/supabaseClient'
import { checkScorecardGate } from '@/utils/scorecardGate'

export interface PlanStep {
  id: string
  name: string
}

/** The stage after `currentJhsId` in the job's hiring plan, or null at the end. */
export async function nextStageFor(jobId: string, currentJhsId: string | null | undefined): Promise<PlanStep | null> {
  const { data: plan, error } = await supabase
    .from('job_hiring_stages')
    .select('id, stage_id, position, custom_stage_name')
    .eq('job_id', jobId)
    .order('position', { ascending: true })
  if (error) throw error
  if (!plan?.length) return null
  type PlanRow = { id: string; stage_id: string; position: number; custom_stage_name: string | null }
  const rows = plan as PlanRow[]
  const stageIds = Array.from(new Set(rows.map((p) => p.stage_id)))
  const { data: stages, error: stagesError } = await supabase
    .from('job_stages')
    .select('id, stage_name')
    .in('id', stageIds)
    .eq('is_active', true)
  if (stagesError) throw stagesError
  const names = new Map(((stages ?? []) as { id: string; stage_name: string }[]).map((s) => [s.id, s.stage_name]))
  const steps = rows
    .filter((p) => names.has(p.stage_id))
    .map((p) => ({ id: p.id, name: p.custom_stage_name || names.get(p.stage_id)! }))
  const at = steps.findIndex((s) => s.id === currentJhsId)
  if (at < 0) return null
  return steps[at + 1] ?? null
}

export type AdvanceResult =
  | { status: 'moved'; to: PlanStep; undo: () => Promise<void> }
  | { status: 'gated'; reason: string }
  | { status: 'last' }

/**
 * Moves the candidate to the next stage of the plan. Refused (gated) when the stage
 * requires a scorecard that isn't in; `undo` puts back the stage and when they
 * entered it.
 */
export async function advanceCandidate(opts: {
  associationId: string
  jobId: string
  currentJhsId: string
}): Promise<AdvanceResult> {
  const to = await nextStageFor(opts.jobId, opts.currentJhsId)
  if (!to) return { status: 'last' }
  const gate = await checkScorecardGate(opts.currentJhsId, opts.associationId)
  if (gate.blocked) return { status: 'gated', reason: gate.reason ?? 'A scorecard is required first.' }

  const { data: before, error: readError } = await supabase
    .from('job_candidate_associations')
    .select('current_stage_id, entered_stage_at')
    .eq('id', opts.associationId)
    .maybeSingle()
  if (readError) throw readError

  const { error } = await supabase
    .from('job_candidate_associations')
    .update({
      current_stage_id: to.id,
      pipeline_position: null,
      booking_link_sent_at: null,
      entered_stage_at: new Date().toISOString(),
    })
    .eq('id', opts.associationId)
  if (error) throw error

  return {
    status: 'moved',
    to,
    undo: async () => {
      const { error: undoError } = await supabase
        .from('job_candidate_associations')
        .update({
          current_stage_id: before?.current_stage_id ?? opts.currentJhsId,
          pipeline_position: null,
          entered_stage_at: before?.entered_stage_at ?? null,
        })
        .eq('id', opts.associationId)
      if (undoError) throw undoError
    },
  }
}

/** Approves the offer at this approver's step (the Offer tab's Approve). */
export async function approveOfferStep(stepId: string): Promise<void> {
  const { error } = await supabase.rpc('offer_approval_decide', { _step_id: stepId, _decision: 'approved', _notes: null })
  if (error) throw error
}

/** The database's own words for an approval it refused (GOA01–GOA09), else a plain line. */
export function approvalError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null
  if (e?.code && /^GOA0\d$/.test(e.code) && e.message) return e.message
  return 'Something went wrong. Try again.'
}

/** The candidate's email, for the Reject dialog opened from the queue. */
export async function candidateEmail(candidateId: string): Promise<string> {
  const { data } = await supabase.from('candidates').select('email').eq('id', candidateId).maybeSingle()
  return (data as { email?: string | null } | null)?.email ?? ''
}

/** The in-job profile, opened on a tab or a focus (the bell's and Slack's addresses). */
export function profileHref(jobId: string, candidateId: string, extra?: string): string {
  return `/jobs/${jobId}/candidates/${candidateId}${extra ? `?${extra}` : ''}`
}
