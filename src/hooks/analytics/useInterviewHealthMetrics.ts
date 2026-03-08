import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { format, eachDayOfInterval } from 'date-fns'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'

export interface InterviewTrendPoint {
  date: string
  scheduled: number
  completed: number
}

export interface InterviewHealthData {
  scheduled: number
  completed: number
  upcoming: number
  cancelled: number
  completionRate: number | null
  trendData: InterviewTrendPoint[]
  isLoading: boolean
  error: Error | null
}

export function useInterviewHealthMetrics(
  finalJobIds: string[],
  dateRange: DateRange,
  enabled: boolean
): InterviewHealthData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-interview-health', finalJobIds.join(','), dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: async () => {
      if (finalJobIds.length === 0) return { scheduled: 0, completed: 0, upcoming: 0, cancelled: 0, completionRate: null, trendData: [] }

      const startISO = dateRange.startDate.toISOString()
      const endISO = dateRange.endDate.toISOString()

      // All bookings for these jobs (non-cancelled) created in range
      const { data: rangeBookings, error: bErr } = await supabase
        .from('scheduled_bookings')
        .select('id, status, scheduled_start, created_at, job_id')
        .in('job_id', finalJobIds)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .not('status', 'eq', 'cancelled')
      if (bErr) throw bErr

      // All bookings (including cancelled) in range for cancellation count
      const { data: allRangeBookings, error: aErr } = await supabase
        .from('scheduled_bookings')
        .select('id, status, scheduled_start, created_at, job_id')
        .in('job_id', finalJobIds)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
      if (aErr) throw aErr

      const now = new Date()
      const scheduled = (rangeBookings || []).length
      const completed = (rangeBookings || []).filter(b => new Date(b.scheduled_start) <= now).length
      const upcoming = (rangeBookings || []).filter(b => new Date(b.scheduled_start) > now).length
      const cancelled = (allRangeBookings || []).filter(b => b.status === 'cancelled').length
      const completionRate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : null

      // Trend data
      const days = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate })
      const trendData: InterviewTrendPoint[] = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const dayScheduled = (rangeBookings || []).filter(b => format(new Date(b.created_at), 'yyyy-MM-dd') === dayStr).length
        const dayCompleted = (rangeBookings || []).filter(b => {
          const ss = new Date(b.scheduled_start)
          return ss <= now && format(ss, 'yyyy-MM-dd') === dayStr
        }).length
        return {
          date: format(day, 'MMM d'),
          scheduled: dayScheduled,
          completed: dayCompleted,
        }
      })

      return { scheduled, completed, upcoming, cancelled, completionRate, trendData }
    },
    enabled: enabled && finalJobIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  return {
    scheduled: data?.scheduled ?? 0,
    completed: data?.completed ?? 0,
    upcoming: data?.upcoming ?? 0,
    cancelled: data?.cancelled ?? 0,
    completionRate: data?.completionRate ?? null,
    trendData: data?.trendData ?? [],
    isLoading,
    error: error as Error | null,
  }
}
