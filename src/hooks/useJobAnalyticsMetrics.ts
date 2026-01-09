import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { format, eachDayOfInterval } from 'date-fns'

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface JobAnalyticsMetrics {
  applications: number
  activeCandidates: number
  totalOffers: number
  totalHires: number
  interviewsScheduled: number
  interviewsCompleted: number
  upcomingInterviews: number
  rejectedCandidates: number
  statusDistribution: { name: string; value: number; color: string }[]
  stageDistribution: { name: string; count: number }[]
  trendData: { date: string; applications: number; active: number; hires: number; interviewsScheduled: number }[]
  isLoading: boolean
  error: Error | null
}

export function useJobAnalyticsMetrics(jobId: string, dateRange: DateRange): JobAnalyticsMetrics {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['job-analytics-metrics', jobId, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: async () => {
      if (!user || !jobId) throw new Error('No user or job ID')

      // Helper functions to get UTC day boundaries
      const startOfDayUTC = (date: Date): string => {
        const d = new Date(date)
        d.setUTCHours(0, 0, 0, 0)
        return d.toISOString()
      }
      
      const endOfDayUTC = (date: Date): string => {
        const d = new Date(date)
        d.setUTCHours(23, 59, 59, 999)
        return d.toISOString()
      }
      
      const startISO = startOfDayUTC(dateRange.startDate)
      const endISO = endOfDayUTC(dateRange.endDate)

      // Fetch job_candidate_associations for this specific job
      const { data: associations, error: assocError } = await supabase
        .from('job_candidate_associations')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          current_stage_id,
          job_hiring_stages!inner(
            id,
            custom_stage_name,
            job_stages!inner(
              id,
              stage_name,
              stage_type
            )
          )
        `)
        .eq('job_id', jobId)

      if (assocError) throw assocError

      // Fetch scheduled bookings for this job (within date range by created_at)
      const { data: bookings, error: bookingsError } = await supabase
        .from('scheduled_bookings')
        .select('id, status, scheduled_start, created_at')
        .eq('job_id', jobId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .not('status', 'eq', 'cancelled')

      if (bookingsError) throw bookingsError

      // Fetch ALL bookings for this job (for upcoming interviews and completed count)
      const { data: allBookings, error: allBookingsError } = await supabase
        .from('scheduled_bookings')
        .select('id, status, scheduled_start, created_at')
        .eq('job_id', jobId)
        .not('status', 'eq', 'cancelled')

      if (allBookingsError) throw allBookingsError

      // Calculate metrics
      const allAssociations = associations || []
      
      // Filter by date range for applications (created_at)
      const applicationsInRange = allAssociations.filter(a => {
        const createdAt = new Date(a.created_at)
        return createdAt >= dateRange.startDate && createdAt <= dateRange.endDate
      })

      // Applications: candidates in 'application' stage type
      const applications = applicationsInRange.filter(a => {
        const stageInfo = a.job_hiring_stages as any
        return stageInfo?.job_stages?.stage_type === 'application'
      }).length

      // Active candidates (status = 'active')
      const activeCandidates = allAssociations.filter(a => a.status === 'active').length

      // Total offers (status = 'offer') within date range
      const totalOffers = allAssociations.filter(a => {
        if (a.status !== 'offer') return false
        const updatedAt = new Date(a.updated_at)
        return updatedAt >= dateRange.startDate && updatedAt <= dateRange.endDate
      }).length

      // Total hires (status = 'hired') within date range
      const totalHires = allAssociations.filter(a => {
        if (a.status !== 'hired') return false
        const updatedAt = new Date(a.updated_at)
        return updatedAt >= dateRange.startDate && updatedAt <= dateRange.endDate
      }).length

      // Rejected candidates
      const rejectedCandidates = allAssociations.filter(a => a.status === 'rejected').length

      // Interviews SCHEDULED within date range (based on created_at)
      const interviewsScheduled = bookings?.length || 0

      // Interviews that HAPPENED/COMPLETED within date range (scheduled_start in past and in range)
      const now = new Date()
      const interviewsCompleted = (allBookings || []).filter(b => {
        const scheduledStart = new Date(b.scheduled_start)
        return scheduledStart <= now && 
               scheduledStart >= dateRange.startDate && 
               scheduledStart <= dateRange.endDate
      }).length

      // Upcoming interviews (snapshot - future interviews not date filtered)
      const upcomingInterviews = (allBookings || []).filter(b => {
        const scheduledStart = new Date(b.scheduled_start)
        return scheduledStart > now
      }).length

      // Status distribution for pie chart
      const statusCounts: Record<string, number> = {}
      allAssociations.forEach(a => {
        const status = a.status || 'unknown'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })

      const statusColors: Record<string, string> = {
        active: 'hsl(var(--virgilio-purple))',
        hired: 'hsl(var(--success))',
        rejected: 'hsl(var(--destructive))',
        offer: 'hsl(var(--info))',
        withdrawn: 'hsl(var(--muted))',
        unknown: 'hsl(var(--muted))'
      }

      const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: statusColors[name] || statusColors.unknown
      }))

      // Stage distribution for bar chart
      const stageCounts: Record<string, number> = {}
      allAssociations.forEach(a => {
        const stageInfo = a.job_hiring_stages as any
        const stageName = stageInfo?.custom_stage_name || stageInfo?.job_stages?.stage_name || 'Unknown'
        stageCounts[stageName] = (stageCounts[stageName] || 0) + 1
      })

      const stageDistribution = Object.entries(stageCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      // Trend data for line chart
      const days = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate })
      const trendData = days.map(day => {
        const dayStartUTC = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0))
        const dayEndUTC = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999))

        const dayApplications = applicationsInRange.filter(a => {
          const createdAt = new Date(a.created_at)
          const stageInfo = a.job_hiring_stages as any
          return createdAt >= dayStartUTC && createdAt <= dayEndUTC && stageInfo?.job_stages?.stage_type === 'application'
        }).length

        const dayActive = allAssociations.filter(a => {
          const createdAt = new Date(a.created_at)
          return a.status === 'active' && createdAt <= dayEndUTC
        }).length

        const dayHires = allAssociations.filter(a => {
          if (a.status !== 'hired') return false
          const updatedAt = new Date(a.updated_at)
          return updatedAt >= dayStartUTC && updatedAt <= dayEndUTC
        }).length

        // Interviews SCHEDULED on this day (by created_at)
        const dayInterviewsScheduled = (bookings || []).filter(b => {
          const createdAt = new Date(b.created_at)
          const createdDate = format(createdAt, 'yyyy-MM-dd')
          const dayDate = format(day, 'yyyy-MM-dd')
          return createdDate === dayDate
        }).length

        return {
          date: format(day, 'MMM d'),
          applications: dayApplications,
          active: dayActive,
          hires: dayHires,
          interviewsScheduled: dayInterviewsScheduled
        }
      })

      return {
        applications,
        activeCandidates,
        totalOffers,
        totalHires,
        interviewsScheduled,
        interviewsCompleted,
        upcomingInterviews,
        rejectedCandidates,
        statusDistribution,
        stageDistribution,
        trendData
      }
    },
    enabled: !!user && !!jobId,
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  return {
    applications: data?.applications ?? 0,
    activeCandidates: data?.activeCandidates ?? 0,
    totalOffers: data?.totalOffers ?? 0,
    totalHires: data?.totalHires ?? 0,
    interviewsScheduled: data?.interviewsScheduled ?? 0,
    interviewsCompleted: data?.interviewsCompleted ?? 0,
    upcomingInterviews: data?.upcomingInterviews ?? 0,
    rejectedCandidates: data?.rejectedCandidates ?? 0,
    statusDistribution: data?.statusDistribution ?? [],
    stageDistribution: data?.stageDistribution ?? [],
    trendData: data?.trendData ?? [],
    isLoading,
    error: error as Error | null
  }
}
