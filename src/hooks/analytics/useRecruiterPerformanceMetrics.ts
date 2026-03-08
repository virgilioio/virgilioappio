import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'

export interface RecruiterRow {
  userId: string
  name: string
  email: string
  candidatesAdded: number
  activePipeline: number
  hires: number
  interviewsBooked: number
}

export interface RecruiterPerformanceData {
  rows: RecruiterRow[]
  isLoading: boolean
  error: Error | null
}

export function useRecruiterPerformanceMetrics(
  finalJobIds: string[],
  dateRange: DateRange,
  enabled: boolean
): RecruiterPerformanceData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-recruiter-perf', finalJobIds.join(','), dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: async () => {
      if (finalJobIds.length === 0) return { rows: [] }

      const startISO = dateRange.startDate.toISOString()
      const endISO = dateRange.endDate.toISOString()

      const [assocsRes, bookingsRes] = await Promise.all([
        supabase.from('job_candidate_associations')
          .select('id, added_by, status, created_at, job_id')
          .in('job_id', finalJobIds),
        supabase.from('scheduled_bookings')
          .select('id, booked_by, created_at, job_id')
          .in('job_id', finalJobIds)
          .gte('created_at', startISO)
          .lte('created_at', endISO)
          .not('status', 'eq', 'cancelled'),
      ])

      if (assocsRes.error) throw assocsRes.error
      if (bookingsRes.error) throw bookingsRes.error

      const assocs = assocsRes.data || []
      const bookings = bookingsRes.data || []

      // Collect unique user IDs
      const userIds = new Set<string>()
      assocs.forEach(a => { if (a.added_by) userIds.add(a.added_by) })
      bookings.forEach(b => { if (b.booked_by) userIds.add(b.booked_by) })

      if (userIds.size === 0) return { rows: [] }

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', Array.from(userIds))

      const profileMap = new Map((profiles || []).map(p => [p.id, p]))

      // Aggregate
      const recruiterMap = new Map<string, RecruiterRow>()
      const getOrCreate = (userId: string): RecruiterRow => {
        if (!recruiterMap.has(userId)) {
          const profile = profileMap.get(userId)
          recruiterMap.set(userId, {
            userId,
            name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : userId.slice(0, 8),
            email: profile?.email || '',
            candidatesAdded: 0,
            activePipeline: 0,
            hires: 0,
            interviewsBooked: 0,
          })
        }
        return recruiterMap.get(userId)!
      }

      assocs.forEach(a => {
        if (!a.added_by) return
        const row = getOrCreate(a.added_by)
        // Candidates added in date range
        if (a.created_at >= startISO && a.created_at <= endISO) {
          row.candidatesAdded++
        }
        if (a.status === 'active') row.activePipeline++
        if (a.status === 'hired') row.hires++
      })

      bookings.forEach(b => {
        if (!b.booked_by) return
        const row = getOrCreate(b.booked_by)
        row.interviewsBooked++
      })

      const rows = Array.from(recruiterMap.values()).sort((a, b) => b.candidatesAdded - a.candidatesAdded)
      return { rows }
    },
    enabled: enabled && finalJobIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  return {
    rows: data?.rows ?? [],
    isLoading,
    error: error as Error | null,
  }
}
