import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface PendingPanelist {
  userId: string
  name: string
  role?: string | null
}

/**
 * Returns interviewers expected to submit a scorecard for the given
 * (stageInstanceId, associationId) — derived from scheduled bookings + their
 * attendees — minus anyone who has already submitted a scorecard.
 */
export function useStagePendingPanelists(
  stageInstanceId?: string | null,
  associationId?: string | null,
  refreshKey?: number | string,
) {
  const [pending, setPending] = useState<PendingPanelist[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!stageInstanceId || !associationId) {
        setPending([])
        return
      }
      setLoading(true)
      try {
        // Bookings for this stage + association (any time, non-cancelled).
        const { data: bookings } = await supabase
          .from('scheduled_bookings')
          .select('id, interviewer_id')
          .eq('job_hiring_stage_id', stageInstanceId)
          .eq('job_candidate_association_id', associationId)
          .not('status', 'eq', 'cancelled')

        const bookingIds = (bookings || []).map(b => b.id)
        const expected = new Set<string>()
        for (const b of bookings || []) {
          if (b.interviewer_id) expected.add(b.interviewer_id)
        }

        if (bookingIds.length) {
          const { data: attendees } = await supabase
            .from('scheduled_booking_attendees')
            .select('user_id, booking_id')
            .in('booking_id', bookingIds)
          for (const a of attendees || []) {
            if (a.user_id) expected.add(a.user_id)
          }
        }

        // Already submitted
        const { data: submitted } = await supabase
          .from('job_stage_scorecards')
          .select('created_by, is_ai_draft, rating')
          .eq('stage_instance_id', stageInstanceId)
          .eq('association_id', associationId)

        const submittedIds = new Set(
          (submitted || [])
            .filter(s => !s.is_ai_draft && !!s.rating)
            .map(s => s.created_by),
        )

        const pendingIds = [...expected].filter(id => !submittedIds.has(id))

        if (pendingIds.length === 0) {
          if (!cancelled) setPending([])
          return
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', pendingIds)

        const profileMap = new Map(
          (profiles || []).map(p => [p.user_id, p]),
        )

        const rows: PendingPanelist[] = pendingIds.map(id => {
          const p = profileMap.get(id)
          const name = p
            ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Interviewer'
            : 'Interviewer'
          return { userId: id, name }
        })

        if (!cancelled) setPending(rows)
      } catch {
        if (!cancelled) setPending([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stageInstanceId, associationId, refreshKey])

  return { pending, loading }
}
