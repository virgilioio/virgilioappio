import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { format, eachDayOfInterval } from 'date-fns'

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface AnalyticsFilters {
  dateRange: DateRange
  recruiterIds?: string[]
  jobIds?: string[]
  organizationIds?: string[]
}

export interface AnalyticsMetrics {
  applications: number
  activeCandidates: number
  totalOffers: number
  totalHires: number
  scheduledInterviews: number
  statusDistribution: { name: string; value: number; color: string }[]
  stageDistribution: { name: string; count: number }[]
  trendData: { date: string; applications: number; active: number; hires: number; interviews: number }[]
  isLoading: boolean
  error: Error | null
}

export function useAnalyticsMetrics(filters: AnalyticsFilters): AnalyticsMetrics {
  const { dateRange, recruiterIds, jobIds, organizationIds } = filters
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'analytics-metrics', 
      user?.id, 
      dateRange.startDate.toISOString(), 
      dateRange.endDate.toISOString(),
      recruiterIds?.join(',') || '',
      jobIds?.join(',') || '',
      organizationIds?.join(',') || ''
    ],
    queryFn: async () => {
      if (!user) throw new Error('No user')

      // Step 1: Get tenant_id from members table (CRITICAL for tenant isolation)
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single()

      if (memberError || !memberData?.tenant_id) {
        console.error('[Analytics] Failed to get tenant_id:', memberError)
        throw new Error('Unable to determine tenant context')
      }

      const tenantId = memberData.tenant_id
      
      // Helper functions to get UTC day boundaries from a Date object
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
      
      console.log('[Analytics] Date range:', { startISO, endISO })

      // Step 2: Fetch jobs for this tenant (with optional organization filter)
      let jobsQuery = supabase
        .from('jobs')
        .select('id')
        .eq('tenant_id', tenantId)

      // Apply organization filter if specified
      if (organizationIds && organizationIds.length > 0) {
        jobsQuery = jobsQuery.in('organization_id', organizationIds)
      }

      const { data: tenantJobs, error: jobsError } = await jobsQuery

      if (jobsError) throw jobsError
      
      // Determine final job IDs: use jobIds filter if provided, otherwise all tenant jobs
      let finalJobIds = tenantJobs?.map(j => j.id) || []
      
      // If specific jobs are selected, intersect with tenant jobs (for security)
      if (jobIds && jobIds.length > 0) {
        const tenantJobSet = new Set(finalJobIds)
        finalJobIds = jobIds.filter(id => tenantJobSet.has(id))
      }

      if (finalJobIds.length === 0) {
        return {
          applications: 0,
          activeCandidates: 0,
          totalOffers: 0,
          totalHires: 0,
          scheduledInterviews: 0,
          statusDistribution: [],
          stageDistribution: [],
          trendData: []
        }
      }

      // Step 3: Fetch job_candidate_associations for these jobs
      let associationsQuery = supabase
        .from('job_candidate_associations')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          current_stage_id,
          added_by,
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
        .in('job_id', finalJobIds)

      // Apply recruiter filter to associations (who added the candidate)
      if (recruiterIds && recruiterIds.length > 0) {
        associationsQuery = associationsQuery.in('added_by', recruiterIds)
      }

      const { data: associations, error: assocError } = await associationsQuery

      if (assocError) throw assocError

      // Step 4: Fetch scheduled bookings for tenant jobs
      let bookingsQuery = supabase
        .from('scheduled_bookings')
        .select('id, status, scheduled_start, job_id, booked_by')
        .in('job_id', finalJobIds)
        .gte('scheduled_start', startISO)
        .lte('scheduled_start', endISO)
        .not('status', 'eq', 'cancelled')

      // Apply recruiter filter to bookings (who scheduled the interview)
      if (recruiterIds && recruiterIds.length > 0) {
        bookingsQuery = bookingsQuery.in('booked_by', recruiterIds)
      }

      const { data: bookings, error: bookingsError } = await bookingsQuery

      if (bookingsError) throw bookingsError

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

      // Scheduled interviews
      const scheduledInterviews = bookings?.length || 0

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
        .slice(0, 10) // Top 10 stages

      // Trend data for line chart
      const days = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate })
      const trendData = days.map(day => {
        // Use UTC for consistent day boundaries
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

        const dayInterviews = (bookings || []).filter(b => {
          const scheduledStart = new Date(b.scheduled_start)
          return scheduledStart >= dayStartUTC && scheduledStart <= dayEndUTC
        }).length

        return {
          date: format(day, 'MMM d'),
          applications: dayApplications,
          active: dayActive,
          hires: dayHires,
          interviews: dayInterviews
        }
      })

      return {
        applications,
        activeCandidates,
        totalOffers,
        totalHires,
        scheduledInterviews,
        statusDistribution,
        stageDistribution,
        trendData
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  return {
    applications: data?.applications ?? 0,
    activeCandidates: data?.activeCandidates ?? 0,
    totalOffers: data?.totalOffers ?? 0,
    totalHires: data?.totalHires ?? 0,
    scheduledInterviews: data?.scheduledInterviews ?? 0,
    statusDistribution: data?.statusDistribution ?? [],
    stageDistribution: data?.stageDistribution ?? [],
    trendData: data?.trendData ?? [],
    isLoading,
    error: error as Error | null
  }
}
