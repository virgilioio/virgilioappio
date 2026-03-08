import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'

export interface JobHealthRow {
  jobId: string
  title: string
  status: string
  totalCandidates: number
  activeCandidates: number
  rejected: number
  offers: number
  hires: number
  interviews: number
  avgTimeToHire: number | null
  /** Flag: job has 0 active and is open */
  isWarning: boolean
}

export interface JobHealthData {
  rows: JobHealthRow[]
  isLoading: boolean
  error: Error | null
}

export function useJobHealthMetrics(
  finalJobIds: string[],
  dateRange: DateRange,
  enabled: boolean
): JobHealthData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-job-health', finalJobIds.join(','), dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: async () => {
      if (finalJobIds.length === 0) return { rows: [] }

      const [jobsRes, assocsRes, bookingsRes] = await Promise.all([
        supabase.from('jobs').select('id, title, status').in('id', finalJobIds),
        supabase.from('job_candidate_associations').select('id, status, job_id, created_at, updated_at, offered_at').in('job_id', finalJobIds),
        supabase.from('scheduled_bookings').select('id, job_id, status, scheduled_start').in('job_id', finalJobIds).not('status', 'eq', 'cancelled'),
      ])

      if (jobsRes.error) throw jobsRes.error
      if (assocsRes.error) throw assocsRes.error
      if (bookingsRes.error) throw bookingsRes.error

      const jobs = jobsRes.data || []
      const assocs = assocsRes.data || []
      const bookings = bookingsRes.data || []

      const now = new Date()
      const rows: JobHealthRow[] = jobs.map(job => {
        const jobAssocs = assocs.filter(a => a.job_id === job.id)
        const active = jobAssocs.filter(a => a.status === 'active').length
        const rejected = jobAssocs.filter(a => a.status === 'rejected').length
        const offers = jobAssocs.filter(a => a.status === 'offer' || a.offered_at).length
        const hired = jobAssocs.filter(a => a.status === 'hired')
        const hires = hired.length

        let avgTimeToHire: number | null = null
        if (hires > 0) {
          const totalDays = hired.reduce((sum, a) => {
            return sum + (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)
          }, 0)
          avgTimeToHire = Math.round(totalDays / hires)
        }

        const jobBookings = bookings.filter(b => b.job_id === job.id)
        const completedInterviews = jobBookings.filter(b => new Date(b.scheduled_start) <= now).length

        return {
          jobId: job.id,
          title: job.title,
          status: job.status,
          totalCandidates: jobAssocs.length,
          activeCandidates: active,
          rejected,
          offers,
          hires,
          interviews: completedInterviews,
          avgTimeToHire,
          isWarning: job.status === 'open' && active === 0 && jobAssocs.length > 0,
        }
      })

      rows.sort((a, b) => b.totalCandidates - a.totalCandidates)
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
