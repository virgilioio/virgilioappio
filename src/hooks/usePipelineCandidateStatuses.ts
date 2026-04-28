import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface CandidateStatusInfo {
  priority: number // 1 = Needs Decision, 2 = Pending Scorecard, 3 = In [time], 4 = Pending Schedule, 5 = Booking Link Sent
  sortTime: number // Timestamp for secondary sorting
}

/**
 * Batch-fetches status data for all candidates in a job pipeline.
 * Returns a Map<associationId, CandidateStatusInfo> for efficient sorting.
 * 
 * Priority order (action-based):
 * 1. Needs Decision (has scorecard submitted) - oldest first
 * 2. Pending Scorecard (interview completed, no scorecard) - oldest first  
 * 3. In [time] (upcoming scheduled interview) - soonest first
 * 4. Pending Schedule (no booking link sent) - oldest first
 * 5. Booking Link Sent (waiting on candidate) - oldest first
 */
export function usePipelineCandidateStatuses(jobId: string, associations: { id: string; candidate_id: string; current_stage_id: string | null; entered_stage_at: string | null; created_at: string }[]) {
  // Get all association IDs, candidate IDs, and stage IDs
  const associationIds = useMemo(() => associations.map(a => a.id), [associations])
  const candidateIds = useMemo(() => [...new Set(associations.map(a => a.candidate_id))], [associations])
  const stageIds = useMemo(() => [...new Set(associations.map(a => a.current_stage_id).filter(Boolean) as string[])], [associations])

  // Batch fetch scorecards for all associations (human-submitted only)
  const { data: scorecards } = useQuery({
    queryKey: ['pipeline-scorecards', jobId, associationIds],
    queryFn: async () => {
      if (associationIds.length === 0) return []
      const { data, error } = await supabase
        .from('job_stage_scorecards')
        .select('id, association_id, stage_instance_id, created_by')
        .eq('job_id', jobId)
        .eq('is_ai_draft', false)
        .in('association_id', associationIds)
      if (error) throw error
      return data || []
    },
    enabled: !!jobId && associationIds.length > 0,
  })

  // Batch fetch bookings for all candidates in relevant stages
  const { data: bookings } = useQuery({
    queryKey: ['pipeline-bookings', jobId, candidateIds, stageIds],
    queryFn: async () => {
      if (candidateIds.length === 0 || stageIds.length === 0) return []
      const { data, error } = await supabase
        .from('scheduled_bookings')
        .select('id, candidate_id, job_hiring_stage_id, scheduled_start, status, candidate_confirmation_status')
        .in('candidate_id', candidateIds)
        .in('job_hiring_stage_id', stageIds)
        .in('status', ['pending', 'confirmed', 'rescheduled', 'completed', 'no_show'])
      if (error) throw error
      return data || []
    },
    enabled: !!jobId && candidateIds.length > 0 && stageIds.length > 0,
  })

  // Batch fetch attendees for the bookings (to derive expected interviewer set)
  const bookingIds = useMemo(() => (bookings || []).map(b => b.id), [bookings])
  const { data: attendees } = useQuery({
    queryKey: ['pipeline-booking-attendees', bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return []
      const { data, error } = await supabase
        .from('scheduled_booking_attendees')
        .select('booking_id, user_id')
        .in('booking_id', bookingIds)
      if (error) throw error
      return data || []
    },
    enabled: bookingIds.length > 0,
  })

  // Batch fetch primary interviewers from bookings (full record incl. interviewer_id)
  const { data: bookingPrimary } = useQuery({
    queryKey: ['pipeline-booking-primary', bookingIds],
    queryFn: async () => {
      if (bookingIds.length === 0) return []
      const { data, error } = await supabase
        .from('scheduled_bookings')
        .select('id, interviewer_id, job_candidate_association_id, job_hiring_stage_id')
        .in('id', bookingIds)
      if (error) throw error
      return data || []
    },
    enabled: bookingIds.length > 0,
  })

  // Batch fetch booking_link_sent_at for all associations
  const { data: associationsData } = useQuery({
    queryKey: ['pipeline-associations-booking-sent', associationIds],
    queryFn: async () => {
      if (associationIds.length === 0) return []
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('id, booking_link_sent_at')
        .in('id', associationIds)
      if (error) throw error
      return data || []
    },
    enabled: associationIds.length > 0,
  })

  // Build status map
  const statusMap = useMemo(() => {
    const map = new Map<string, CandidateStatusInfo>()
    const now = Date.now()

    // Index scorecards by association_id + stage_instance_id, also collect authors
    const scorecardsByAssocStage = new Map<string, boolean>()
    const scorecardAuthorsByAssocStage = new Map<string, Set<string>>()
    for (const sc of scorecards || []) {
      const key = `${sc.association_id}:${sc.stage_instance_id}`
      scorecardsByAssocStage.set(key, true)
      if ((sc as any).created_by) {
        const set = scorecardAuthorsByAssocStage.get(key) || new Set<string>()
        set.add((sc as any).created_by)
        scorecardAuthorsByAssocStage.set(key, set)
      }
    }

    // Index attendees by booking_id
    const attendeesByBooking = new Map<string, string[]>()
    for (const a of attendees || []) {
      if (!a.user_id) continue
      const arr = attendeesByBooking.get(a.booking_id) || []
      arr.push(a.user_id)
      attendeesByBooking.set(a.booking_id, arr)
    }

    // Index primary interviewer + assoc/stage by booking_id
    const primaryByBooking = new Map<string, { interviewer_id: string | null; assoc: string | null; stage: string | null }>()
    for (const bp of bookingPrimary || []) {
      primaryByBooking.set(bp.id, {
        interviewer_id: bp.interviewer_id,
        assoc: bp.job_candidate_association_id,
        stage: bp.job_hiring_stage_id,
      })
    }

    // Build expected interviewer set per (assoc, stage), unioning across all bookings for that pair
    const expectedByAssocStage = new Map<string, Set<string>>()
    for (const bp of bookingPrimary || []) {
      if (!bp.job_candidate_association_id || !bp.job_hiring_stage_id) continue
      const key = `${bp.job_candidate_association_id}:${bp.job_hiring_stage_id}`
      const set = expectedByAssocStage.get(key) || new Set<string>()
      if (bp.interviewer_id) set.add(bp.interviewer_id)
      for (const uid of attendeesByBooking.get(bp.id) || []) set.add(uid)
      expectedByAssocStage.set(key, set)
    }

    // Index bookings by candidate_id + stage_id
    const bookingsByCandidateStage = new Map<string, typeof bookings>()
    for (const b of bookings || []) {
      const key = `${b.candidate_id}:${b.job_hiring_stage_id}`
      if (!bookingsByCandidateStage.has(key)) {
        bookingsByCandidateStage.set(key, [])
      }
      bookingsByCandidateStage.get(key)!.push(b)
    }

    // Index booking_link_sent_at by association_id
    const bookingLinkSentByAssoc = new Map<string, string | null>()
    for (const a of associationsData || []) {
      bookingLinkSentByAssoc.set(a.id, a.booking_link_sent_at)
    }

    for (const assoc of associations) {
      const stageId = assoc.current_stage_id
      if (!stageId) {
        map.set(assoc.id, { priority: 5, sortTime: new Date(assoc.entered_stage_at || assoc.created_at).getTime() })
        continue
      }

      const key = `${assoc.id}:${stageId}`
      const hasAnyScorecard = scorecardsByAssocStage.get(key) || false

      // Determine if ALL expected interviewers have submitted
      const expected = expectedByAssocStage.get(key)
      const authors = scorecardAuthorsByAssocStage.get(key) || new Set<string>()
      const allSubmitted = !!expected && expected.size > 0 &&
        [...expected].every(uid => authors.has(uid))

      const candidateStageKey = `${assoc.candidate_id}:${stageId}`
      const stageBookings = bookingsByCandidateStage.get(candidateStageKey) || []

      const bookingLinkSentAt = bookingLinkSentByAssoc.get(assoc.id)
      const enteredStageTime = new Date(assoc.entered_stage_at || assoc.created_at).getTime()

      const completedInterview = stageBookings.find(b =>
        b.status === 'completed' ||
        b.status === 'no_show' ||
        (b.status === 'confirmed' && new Date(b.scheduled_start).getTime() < now)
      )

      const upcomingInterview = stageBookings.find(b =>
        (b.status === 'confirmed' || b.status === 'rescheduled') &&
        new Date(b.scheduled_start).getTime() >= now
      )

      const pendingBookingLink = stageBookings.find(b =>
        b.status === 'pending' ||
        (b.candidate_confirmation_status === 'pending' && b.status !== 'cancelled')
      )

      // Priority 1: ALL expected interviewers submitted -> Needs Decision
      if (allSubmitted) {
        map.set(assoc.id, { priority: 1, sortTime: enteredStageTime })
        continue
      }

      // Priority 2: Completed interview but not all scorecards in -> Pending Scorecard
      // (also covers "some submitted, some still pending" in multi-interviewer)
      if (completedInterview || (hasAnyScorecard && !allSubmitted)) {
        const sortRef = completedInterview ? new Date(completedInterview.scheduled_start).getTime() : enteredStageTime
        map.set(assoc.id, { priority: 2, sortTime: sortRef })
        continue
      }

      if (upcomingInterview) {
        map.set(assoc.id, { priority: 3, sortTime: new Date(upcomingInterview.scheduled_start).getTime() })
        continue
      }

      if (!bookingLinkSentAt && !pendingBookingLink) {
        map.set(assoc.id, { priority: 4, sortTime: enteredStageTime })
        continue
      }

      map.set(assoc.id, { priority: 5, sortTime: bookingLinkSentAt ? new Date(bookingLinkSentAt).getTime() : enteredStageTime })
    }

    return map
  }, [associations, scorecards, bookings, associationsData, attendees, bookingPrimary])

  // isLoading is true until all queries that we need have returned data
  const isLoading = !scorecards || !bookings || !associationsData

  return { statusMap, isLoading }
}
