import { supabase } from '@/lib/supabaseClient'

export interface ScorecardGateResult {
  blocked: boolean
  reason?: string
  pendingCount?: number
}

/**
 * Checks whether the "Require scorecard" rule blocks advancing this candidate
 * out of the given stage. Mirrors the panelist logic used in
 * useStagePendingPanelists but runs one-off.
 */
export async function checkScorecardGate(
  currentJhsId: string | null | undefined,
  associationId: string | null | undefined,
): Promise<ScorecardGateResult> {
  if (!currentJhsId || !associationId) return { blocked: false }

  const { data: stage } = await supabase
    .from('job_hiring_stages')
    .select('require_scorecard, custom_stage_name, job_stages!inner(stage_name)')
    .eq('id', currentJhsId)
    .maybeSingle()

  if (!stage || !(stage as any).require_scorecard) return { blocked: false }

  const stageName =
    (stage as any).custom_stage_name || (stage as any).job_stages?.stage_name || 'this stage'

  // Bookings for this stage + association (non-cancelled) → expected interviewers
  const { data: bookings } = await supabase
    .from('scheduled_bookings')
    .select('id, interviewer_id')
    .eq('job_hiring_stage_id', currentJhsId)
    .eq('job_candidate_association_id', associationId)
    .not('status', 'eq', 'cancelled')

  const bookingIds = (bookings || []).map((b) => b.id)
  const expected = new Set<string>()
  for (const b of bookings || []) if (b.interviewer_id) expected.add(b.interviewer_id)

  if (bookingIds.length) {
    const { data: attendees } = await supabase
      .from('scheduled_booking_attendees')
      .select('user_id, booking_id')
      .in('booking_id', bookingIds)
    for (const a of attendees || []) if (a.user_id) expected.add(a.user_id)
  }

  // If no scheduled interviewers exist yet, fall back to stage assignments
  if (expected.size === 0) {
    const { data: assignments } = await supabase
      .from('stage_interviewer_assignments')
      .select('member_id, assignment_type')
      .eq('job_hiring_stage_id', currentJhsId)
    const memberIds = (assignments || [])
      .filter((a) => a.assignment_type === 'required')
      .map((a) => a.member_id)
    if (memberIds.length) {
      const { data: members } = await supabase
        .from('members')
        .select('user_id')
        .in('id', memberIds)
      for (const m of members || []) if (m.user_id) expected.add(m.user_id)
    }
  }

  if (expected.size === 0) {
    // Nobody assigned yet → gate can't be satisfied. Block.
    return {
      blocked: true,
      reason: `Scorecard required to advance from "${stageName}". Assign an interviewer and submit a scorecard first.`,
      pendingCount: 0,
    }
  }

  const { data: submitted } = await supabase
    .from('job_stage_scorecards')
    .select('created_by, is_ai_draft, rating')
    .eq('stage_instance_id', currentJhsId)
    .eq('association_id', associationId)

  const submittedIds = new Set(
    (submitted || [])
      .filter((s) => !s.is_ai_draft && !!s.rating)
      .map((s) => s.created_by),
  )

  const pending = [...expected].filter((id) => !submittedIds.has(id))
  if (pending.length === 0) return { blocked: false }

  return {
    blocked: true,
    reason:
      pending.length === 1
        ? `Scorecard required to advance from "${stageName}". 1 interviewer still owes a scorecard.`
        : `Scorecard required to advance from "${stageName}". ${pending.length} interviewers still owe scorecards.`,
    pendingCount: pending.length,
  }
}
