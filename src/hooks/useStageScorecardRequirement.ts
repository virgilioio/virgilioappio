import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type ScorecardReminderCadence = 'daily' | 'every_2_days' | 'weekly'

export interface RequiredPanelist {
  userId: string
  name: string
  roleLabel?: string | null
  lastRequestedAt?: string | null
  sentCount?: number | null
}

export interface StageScorecardRequirement {
  loading: boolean
  requireScorecard: boolean
  remindersEnabled: boolean
  cadence: ScorecardReminderCadence
  stageName: string
  nextStageName: string | null
  candidateFirstName: string | null
  totalExpected: number
  submittedCount: number
  pending: RequiredPanelist[]
  refresh: () => void
}

const CADENCE_LABEL: Record<ScorecardReminderCadence, string> = {
  daily: 'daily',
  every_2_days: 'every 2 days',
  weekly: 'weekly',
}

export function cadenceLabel(c: ScorecardReminderCadence): string {
  return CADENCE_LABEL[c] || 'daily'
}

/**
 * Full data source for the "Scorecard required" UI on the candidate profile.
 * Reads the per-stage require_scorecard / reminder settings, computes
 * expected vs submitted interviewers for the (stage, association) pair,
 * and joins the tracker table so rows can show "Requested X ago".
 */
export function useStageScorecardRequirement(
  stageInstanceId?: string | null,
  associationId?: string | null,
  refreshKey?: number | string,
): StageScorecardRequirement {
  const [state, setState] = useState<StageScorecardRequirement>({
    loading: false,
    requireScorecard: false,
    remindersEnabled: false,
    cadence: 'daily',
    stageName: 'this stage',
    nextStageName: null,
    candidateFirstName: null,
    totalExpected: 0,
    submittedCount: 0,
    pending: [],
    refresh: () => {},
  })
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!stageInstanceId || !associationId) {
        setState((s) => ({ ...s, loading: false, requireScorecard: false, pending: [], refresh }))
        return
      }
      setState((s) => ({ ...s, loading: true, refresh }))

      const { data: stage } = await supabase
        .from('job_hiring_stages')
        .select(
          'id, job_id, position, require_scorecard, scorecard_reminders_enabled, scorecard_reminder_cadence, custom_stage_name, job_stages!inner(stage_name)',
        )
        .eq('id', stageInstanceId)
        .maybeSingle()

      const stageAny = stage as any
      const stageName =
        stageAny?.custom_stage_name || stageAny?.job_stages?.stage_name || 'this stage'
      const requireScorecard = !!stageAny?.require_scorecard
      const remindersEnabled = !!stageAny?.scorecard_reminders_enabled
      const cadence = (stageAny?.scorecard_reminder_cadence || 'daily') as ScorecardReminderCadence

      // Next stage name
      let nextStageName: string | null = null
      if (stageAny?.job_id != null && stageAny?.position != null) {
        const { data: nextRows } = await supabase
          .from('job_hiring_stages')
          .select('custom_stage_name, position, job_stages!inner(stage_name)')
          .eq('job_id', stageAny.job_id)
          .gt('position', stageAny.position)
          .order('position', { ascending: true })
          .limit(1)
        const nextAny = (nextRows || [])[0] as any
        if (nextAny) nextStageName = nextAny.custom_stage_name || nextAny.job_stages?.stage_name || null
      }

      // Candidate first name
      const { data: assoc } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id, candidates!inner(first_name, candidate_name)')
        .eq('id', associationId)
        .maybeSingle()
      const cand = (assoc as any)?.candidates
      const candidateFirstName =
        cand?.first_name || (cand?.candidate_name ? String(cand.candidate_name).split(' ')[0] : null)

      // Expected interviewer set
      const { data: bookings } = await supabase
        .from('scheduled_bookings')
        .select('id, interviewer_id')
        .eq('job_hiring_stage_id', stageInstanceId)
        .eq('job_candidate_association_id', associationId)
        .not('status', 'eq', 'cancelled')

      const expected = new Set<string>()
      const bookingIds = (bookings || []).map((b) => b.id)
      for (const b of bookings || []) if ((b as any).interviewer_id) expected.add((b as any).interviewer_id)
      if (bookingIds.length) {
        const { data: attendees } = await supabase
          .from('scheduled_booking_attendees')
          .select('user_id, booking_id')
          .in('booking_id', bookingIds)
        for (const a of attendees || []) if (a.user_id) expected.add(a.user_id)
      }
      if (expected.size === 0) {
        const { data: assignments } = await supabase
          .from('stage_interviewer_assignments')
          .select('member_id, assignment_type')
          .eq('job_hiring_stage_id', stageInstanceId)
        const memberIds = (assignments || [])
          .filter((a: any) => a.assignment_type === 'required')
          .map((a: any) => a.member_id)
        if (memberIds.length) {
          const { data: members } = await supabase
            .from('members')
            .select('user_id')
            .in('id', memberIds)
          for (const m of members || []) if ((m as any).user_id) expected.add((m as any).user_id)
        }
      }

      // Submitted
      const { data: submittedRows } = await supabase
        .from('job_stage_scorecards')
        .select('created_by, is_ai_draft, rating')
        .eq('stage_instance_id', stageInstanceId)
        .eq('association_id', associationId)
      const submittedIds = new Set(
        (submittedRows || [])
          .filter((s: any) => !s.is_ai_draft && !!s.rating)
          .map((s: any) => s.created_by),
      )
      const pendingIds = [...expected].filter((id) => !submittedIds.has(id))

      // Profile lookups
      const profileMap = new Map<string, any>()
      if (pendingIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', pendingIds)
        for (const p of profiles || []) profileMap.set((p as any).user_id, p)
      }

      // Reminder tracker
      const trackerMap = new Map<string, any>()
      if (pendingIds.length) {
        const { data: tracker } = await supabase
          .from('scorecard_reminder_sends')
          .select('interviewer_user_id, last_sent_at, sent_count')
          .eq('association_id', associationId)
          .eq('job_hiring_stage_id', stageInstanceId)
          .in('interviewer_user_id', pendingIds)
        for (const t of tracker || []) trackerMap.set((t as any).interviewer_user_id, t)
      }

      const pending: RequiredPanelist[] = pendingIds.map((id) => {
        const p = profileMap.get(id)
        const t = trackerMap.get(id)
        const name = p
          ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Interviewer'
          : 'Interviewer'
        return {
          userId: id,
          name,
          lastRequestedAt: t?.last_sent_at ?? null,
          sentCount: t?.sent_count ?? null,
        }
      })

      if (!cancelled) {
        setState({
          loading: false,
          requireScorecard,
          remindersEnabled,
          cadence,
          stageName,
          nextStageName,
          candidateFirstName,
          totalExpected: expected.size,
          submittedCount: submittedIds.size,
          pending,
          refresh,
        })
      }
    })().catch(() => {
      if (!cancelled) setState((s) => ({ ...s, loading: false, refresh }))
    })
    return () => {
      cancelled = true
    }
  }, [stageInstanceId, associationId, refreshKey, nonce, refresh])

  return state
}

/** Small helper for "requested Xd ago" style text. */
export function timeAgoShort(iso?: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return ''
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
