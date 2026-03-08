import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { format, eachDayOfInterval } from 'date-fns'

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface InterviewsByStage {
  stageName: string
  count: number
}

export interface StageConversion {
  fromStage: string
  toStage: string
  count: number
  rate: number
}

export interface AvgTimePerStage {
  stageName: string
  avgDays: number
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
  trendData: { date: string; applications: number; active: number; hires: number; interviewsScheduled: number; offers: number; rejected: number; interviewsCompleted: number }[]
  // New recruiting insight metrics
  interviewsByStage: InterviewsByStage[]
  stageConversions: StageConversion[]
  avgTimePerStage: AvgTimePerStage[]
  isLoading: boolean
  error: Error | null
}

export function useJobAnalyticsMetrics(jobId: string, dateRange: DateRange): JobAnalyticsMetrics {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['job-analytics-metrics', jobId, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: async () => {
      if (!user || !jobId) throw new Error('No user or job ID')

      // SECURITY: Verify the job belongs to the user's tenant (defense in depth)
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single()

      if (memberError || !memberData?.tenant_id) {
        console.error('[JobAnalytics] Failed to get tenant_id:', memberError)
        throw new Error('Unable to determine tenant context')
      }

      const tenantId = memberData.tenant_id

      // Verify the job belongs to this tenant before fetching any analytics
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, tenant_id')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single()

      if (jobError || !jobData) {
        console.error('[JobAnalytics] Job not accessible or not in tenant:', { jobId, tenantId, error: jobError })
        throw new Error('Job not accessible')
      }

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
        .select(`
          id, 
          status, 
          scheduled_start, 
          created_at,
          job_hiring_stage_id,
          job_hiring_stages!inner(
            id,
            custom_stage_name,
            position,
            job_stages!inner(stage_name)
          )
        `)
        .eq('job_id', jobId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .not('status', 'eq', 'cancelled')

      if (bookingsError) throw bookingsError

      // Fetch ALL bookings for this job (for upcoming interviews and completed count)
      const { data: allBookings, error: allBookingsError } = await supabase
        .from('scheduled_bookings')
        .select(`
          id, 
          status, 
          scheduled_start, 
          created_at,
          job_hiring_stage_id,
          job_hiring_stages!inner(
            id,
            custom_stage_name,
            position,
            job_stages!inner(stage_name)
          )
        `)
        .eq('job_id', jobId)
        .not('status', 'eq', 'cancelled')

      if (allBookingsError) throw allBookingsError

      // Calculate metrics
      const allAssociations = associations || []

      // Fetch stage history for conversion rates and time-in-stage calculations
      const associationIds = allAssociations.map(a => a.id)
      const { data: stageHistory, error: historyError } = await supabase
        .from('job_candidate_stage_history')
        .select(`
          id,
          association_id,
          from_stage_id,
          to_stage_id,
          moved_at
        `)
        .in('association_id', associationIds.length > 0 ? associationIds : ['no-match'])
        .order('moved_at', { ascending: true })

      if (historyError) throw historyError

      // Fetch job hiring stages for stage names
      const { data: jobStages, error: jobStagesError } = await supabase
        .from('job_hiring_stages')
        .select(`
          id,
          position,
          custom_stage_name,
          job_stages!inner(stage_name)
        `)
        .eq('job_id', jobId)
        .order('position', { ascending: true })

      if (jobStagesError) throw jobStagesError
      
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

      // === NEW: Interviews by Stage (within date range) ===
      const interviewsByStageMap: Record<string, { count: number, position: number }> = {}
      ;(bookings || []).forEach(b => {
        const stageInfo = b.job_hiring_stages as any
        const stageName = stageInfo?.custom_stage_name || stageInfo?.job_stages?.stage_name || 'Unknown'
        const position = stageInfo?.position ?? 999
        if (!interviewsByStageMap[stageName]) {
          interviewsByStageMap[stageName] = { count: 0, position }
        }
        interviewsByStageMap[stageName].count++
      })
      const interviewsByStage = Object.entries(interviewsByStageMap)
        .map(([stageName, data]) => ({ stageName, count: data.count, position: data.position }))
        .sort((a, b) => a.position - b.position)
        .map(({ stageName, count }) => ({ stageName, count }))

      // === NEW: Stage Conversions ===
      // Build a map of stage ID to stage name and position
      const stageIdToInfo: Record<string, { name: string, position: number }> = {}
      ;(jobStages || []).forEach(s => {
        const stageInfo = s as any
        const name = stageInfo.custom_stage_name || stageInfo.job_stages?.stage_name || 'Unknown'
        stageIdToInfo[s.id] = { name, position: s.position }
      })

      // Count transitions between stages
      const transitionCounts: Record<string, { count: number, fromPos: number, toPos: number }> = {}
      ;(stageHistory || []).forEach(h => {
        if (!h.from_stage_id || !h.to_stage_id) return
        const fromInfo = stageIdToInfo[h.from_stage_id]
        const toInfo = stageIdToInfo[h.to_stage_id]
        if (!fromInfo || !toInfo) return
        
        const key = `${fromInfo.name}|${toInfo.name}`
        if (!transitionCounts[key]) {
          transitionCounts[key] = { count: 0, fromPos: fromInfo.position, toPos: toInfo.position }
        }
        transitionCounts[key].count++
      })

      // Calculate conversion rates based on candidates who entered each stage
      const candidatesPerStage: Record<string, Set<string>> = {}
      ;(stageHistory || []).forEach(h => {
        if (h.to_stage_id && stageIdToInfo[h.to_stage_id]) {
          const stageName = stageIdToInfo[h.to_stage_id].name
          if (!candidatesPerStage[stageName]) candidatesPerStage[stageName] = new Set()
          candidatesPerStage[stageName].add(h.association_id)
        }
      })

      const stageConversions: { fromStage: string, toStage: string, count: number, rate: number, fromPos: number }[] = []
      Object.entries(transitionCounts).forEach(([key, data]) => {
        const [fromStage, toStage] = key.split('|')
        const fromCount = candidatesPerStage[fromStage]?.size || 0
        const rate = fromCount > 0 ? (data.count / fromCount) * 100 : 0
        stageConversions.push({ fromStage, toStage, count: data.count, rate, fromPos: data.fromPos })
      })
      stageConversions.sort((a, b) => a.fromPos - b.fromPos)

      // === NEW: Average Time per Stage ===
      // Group stage history by association to calculate time in each stage
      const historyByAssoc: Record<string, typeof stageHistory> = {}
      ;(stageHistory || []).forEach(h => {
        if (!historyByAssoc[h.association_id]) historyByAssoc[h.association_id] = []
        historyByAssoc[h.association_id].push(h)
      })

      const timePerStage: Record<string, number[]> = {}
      Object.values(historyByAssoc).forEach(history => {
        // Sort by moved_at
        const sorted = [...history].sort((a, b) => new Date(a.moved_at).getTime() - new Date(b.moved_at).getTime())
        
        for (let i = 0; i < sorted.length; i++) {
          const current = sorted[i]
          if (!current.to_stage_id || !stageIdToInfo[current.to_stage_id]) continue
          
          const stageName = stageIdToInfo[current.to_stage_id].name
          const enteredAt = new Date(current.moved_at)
          
          // Find when they left this stage (next move)
          const nextMove = sorted[i + 1]
          if (nextMove) {
            const leftAt = new Date(nextMove.moved_at)
            const daysInStage = (leftAt.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24)
            if (!timePerStage[stageName]) timePerStage[stageName] = []
            timePerStage[stageName].push(daysInStage)
          }
        }
      })

      const avgTimePerStage = Object.entries(timePerStage)
        .map(([stageName, times]) => ({
          stageName,
          avgDays: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
        }))
        .filter(s => s.avgDays > 0)
        .sort((a, b) => {
          // Sort by stage position if available
          const aPos = Object.values(stageIdToInfo).find(s => s.name === a.stageName)?.position ?? 999
          const bPos = Object.values(stageIdToInfo).find(s => s.name === b.stageName)?.position ?? 999
          return aPos - bPos
        })

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
        trendData,
        interviewsByStage,
        stageConversions: stageConversions.map(({ fromStage, toStage, count, rate }) => ({ fromStage, toStage, count, rate })),
        avgTimePerStage
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
    interviewsByStage: data?.interviewsByStage ?? [],
    stageConversions: data?.stageConversions ?? [],
    avgTimePerStage: data?.avgTimePerStage ?? [],
    isLoading,
    error: error as Error | null
  }
}
