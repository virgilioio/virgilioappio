import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { RequiredPanelist } from '@/hooks/useStageScorecardRequirement'

export interface StageRequirementSummary {
  stageInstanceId: string
  position: number
  requireScorecard: boolean
  totalExpected: number
  submittedCount: number
  pending: RequiredPanelist[]
}

export interface ApplicationScorecardRequirements {
  loading: boolean
  byStage: Record<string, StageRequirementSummary>
  refresh: () => void
}

/**
 * Batched, application-wide version of `useStageScorecardRequirement`.
 *
 * Computes expected-vs-submitted interviewers for EVERY stage the candidate has
 * already reached (position <= current stage position), so pending/required
 * scorecards from earlier stages remain visible after the candidate advances.
 * Uses one query per table (`.in(...)` over the reached stage ids) instead of
 * one round-trip per stage.
 */
export function useApplicationScorecardRequirements(
  associationId?: string | null,
  jobId?: string | null,
  currentStagePosition?: number | null,
  refreshKey?: number | string,
): ApplicationScorecardRequirements {
  const [loading, setLoading] = useState(false)
  const [byStage, setByStage] = useState<Record<string, StageRequirementSummary>>({})
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!associationId || !jobId) {
        setByStage({})
        return
      }
      setLoading(true)

      // 1. Stages of this job the candidate has reached.
      const { data: stageRows } = await supabase
        .from('job_hiring_stages')
        .select('id, position, require_scorecard')
        .eq('job_id', jobId)
        .order('position', { ascending: true })

      const reached = (stageRows || []).filter((s: any) =>
        currentStagePosition == null ? true : (s.position ?? 0) <= currentStagePosition,
      ) as any[]
      const stageIds = reached.map((s) => s.id as string)
      if (stageIds.length === 0) {
        if (!cancelled) {
          setByStage({})
          setLoading(false)
        }
        return
      }

      // 2. Expected interviewers per stage: bookings (+ attendees), falling back
      //    to stage_interviewer_assignments when there are no bookings.
      const { data: bookings } = await supabase
        .from('scheduled_bookings')
        .select('id, interviewer_id, job_hiring_stage_id')
        .eq('job_candidate_association_id', associationId)
        .in('job_hiring_stage_id', stageIds)
        .not('status', 'eq', 'cancelled')

      const expectedByStage: Record<string, Set<string>> = {}
      for (const id of stageIds) expectedByStage[id] = new Set()

      const stageByBookingId = new Map<string, string>()
      for (const b of (bookings || []) as any[]) {
        if (b.job_hiring_stage_id) stageByBookingId.set(b.id, b.job_hiring_stage_id)
        if (b.interviewer_id && b.job_hiring_stage_id) {
          expectedByStage[b.job_hiring_stage_id]?.add(b.interviewer_id)
        }
      }

      const bookingIds = Array.from(stageByBookingId.keys())
      if (bookingIds.length) {
        const { data: attendees } = await supabase
          .from('scheduled_booking_attendees')
          .select('user_id, booking_id')
          .in('booking_id', bookingIds)
        for (const a of (attendees || []) as any[]) {
          const sid = stageByBookingId.get(a.booking_id)
          if (sid && a.user_id) expectedByStage[sid]?.add(a.user_id)
        }
      }

      const stagesWithoutBookings = stageIds.filter((id) => expectedByStage[id].size === 0)
      if (stagesWithoutBookings.length) {
        const { data: assignments } = await supabase
          .from('stage_interviewer_assignments')
          .select('member_id, job_hiring_stage_id, assignment_type')
          .in('job_hiring_stage_id', stagesWithoutBookings)

        const requiredAssignments = ((assignments || []) as any[]).filter(
          (a) => a.assignment_type === 'required',
        )
        const memberIds = Array.from(
          new Set(requiredAssignments.map((a) => a.member_id).filter(Boolean)),
        )
        const userByMember = new Map<string, string>()
        if (memberIds.length) {
          const { data: members } = await supabase
            .from('members')
            .select('id, user_id')
            .in('id', memberIds)
          for (const m of (members || []) as any[]) {
            if (m.user_id) userByMember.set(m.id, m.user_id)
          }
        }
        for (const a of requiredAssignments) {
          const uid = userByMember.get(a.member_id)
          if (uid && a.job_hiring_stage_id) expectedByStage[a.job_hiring_stage_id]?.add(uid)
        }
      }

      // 3. Already-submitted (real, rated) scorecards per stage.
      const { data: submittedRows } = await supabase
        .from('job_stage_scorecards')
        .select('created_by, is_ai_draft, rating, stage_instance_id')
        .eq('association_id', associationId)
        .in('stage_instance_id', stageIds)

      const submittedByStage: Record<string, Set<string>> = {}
      for (const id of stageIds) submittedByStage[id] = new Set()
      for (const s of (submittedRows || []) as any[]) {
        if (s.is_ai_draft || !s.rating) continue
        if (s.stage_instance_id) submittedByStage[s.stage_instance_id]?.add(s.created_by)
      }

      // 4. Pending ids + profile / reminder-tracker lookups (batched).
      const pendingByStage: Record<string, string[]> = {}
      const allPendingIds = new Set<string>()
      for (const id of stageIds) {
        const pend = [...expectedByStage[id]].filter((uid) => !submittedByStage[id].has(uid))
        pendingByStage[id] = pend
        pend.forEach((p) => allPendingIds.add(p))
      }

      const profileMap = new Map<string, any>()
      if (allPendingIds.size) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', [...allPendingIds])
        for (const p of (profiles || []) as any[]) profileMap.set(p.user_id, p)
      }

      const trackerMap = new Map<string, any>()
      if (allPendingIds.size) {
        const { data: tracker } = await supabase
          .from('scorecard_reminder_sends')
          .select('interviewer_user_id, last_sent_at, sent_count, job_hiring_stage_id')
          .eq('association_id', associationId)
          .in('job_hiring_stage_id', stageIds)
        for (const t of (tracker || []) as any[]) {
          trackerMap.set(`${t.job_hiring_stage_id}:${t.interviewer_user_id}`, t)
        }
      }

      const result: Record<string, StageRequirementSummary> = {}
      for (const stage of reached) {
        const id = stage.id as string
        const pending: RequiredPanelist[] = pendingByStage[id].map((uid) => {
          const p = profileMap.get(uid)
          const t = trackerMap.get(`${id}:${uid}`)
          return {
            userId: uid,
            name: p
              ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Interviewer'
              : 'Interviewer',
            lastRequestedAt: t?.last_sent_at ?? null,
            sentCount: t?.sent_count ?? null,
          }
        })
        result[id] = {
          stageInstanceId: id,
          position: stage.position ?? 0,
          requireScorecard: !!stage.require_scorecard,
          totalExpected: expectedByStage[id].size,
          submittedCount: submittedByStage[id].size,
          pending,
        }
      }

      if (!cancelled) {
        setByStage(result)
        setLoading(false)
      }
    })().catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [associationId, jobId, currentStagePosition, refreshKey, nonce])

  return { loading, byStage, refresh }
}
