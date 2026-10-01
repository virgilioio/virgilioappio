import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { eventAt } from '@/lib/analyticsEventDates'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'

export interface IphRow { label: string; screenings: number; hires: number }

export interface InterviewsPerHireData {
  screenings: number
  hires: number
  /** screenings ÷ hires, null when no hires */
  ratio: number | null
  byJob: IphRow[]
  byRecruiter: IphRow[]
  monthly: { label: string; screenings: number; hires: number }[]
  isLoading: boolean
}

export const ratioOf = (s: number, h: number) => (h > 0 ? Math.round((s / h) * 10) / 10 : null)

/**
 * Screenings = first non-cancelled interview per (candidate, job), counted when it was scheduled.
 * Hires = hired associations dated by eventAt() (hired_at).
 */
export function useInterviewsPerHireMetrics(finalJobIds: string[], dateRange: DateRange, enabled: boolean): InterviewsPerHireData {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-iph', finalJobIds.join(','), dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: async () => {
      const [jobsRes, bRes, aRes] = await Promise.all([
        supabase.from('jobs').select('id, title').in('id', finalJobIds),
        supabase.from('scheduled_bookings').select('candidate_id, job_id, created_at, booked_by, status').in('job_id', finalJobIds).not('status', 'eq', 'cancelled').order('created_at', { ascending: true }),
        supabase.from('job_candidate_associations').select('job_id, status, added_by, hired_at, offered_at, rejected_at, updated_at').in('job_id', finalJobIds).eq('status', 'hired'),
      ])
      if (jobsRes.error) throw jobsRes.error
      if (bRes.error) throw bRes.error
      if (aRes.error) throw aRes.error

      const inRange = (d: Date) => d >= dateRange.startDate && d <= dateRange.endDate
      const first = new Map<string, any>()
      for (const b of bRes.data || []) {
        if (!b.candidate_id || !b.job_id) continue
        const k = `${b.candidate_id}:${b.job_id}`
        if (!first.has(k)) first.set(k, b)
      }
      const screens = [...first.values()].filter(b => inRange(new Date(b.created_at)))
      const hires = (aRes.data || []).filter(a => inRange(eventAt(a)))

      const jobTitle = new Map((jobsRes.data || []).map(j => [j.id, j.title]))
      const userIds = new Set<string>()
      screens.forEach(b => b.booked_by && userIds.add(b.booked_by))
      hires.forEach(a => a.added_by && userIds.add(a.added_by))
      const names = new Map<string, string>()
      if (userIds.size) {
        const { data: profs } = await (supabase as any).from('profiles').select('id, full_name, email').in('id', [...userIds])
        ;(profs || []).forEach((p: any) => names.set(p.id, p.full_name || p.email || 'Unknown'))
      }

      const tally = (keyS: (b: any) => string | null, keyH: (a: any) => string | null) => {
        const m = new Map<string, IphRow>()
        const get = (k: string) => m.get(k) ?? (m.set(k, { label: k, screenings: 0, hires: 0 }), m.get(k)!)
        screens.forEach(b => { const k = keyS(b); if (k) get(k).screenings++ })
        hires.forEach(a => { const k = keyH(a); if (k) get(k).hires++ })
        return [...m.values()]
      }
      const byJob = tally(b => jobTitle.get(b.job_id) ?? null, a => jobTitle.get(a.job_id) ?? null)
      const byRecruiter = tally(b => (b.booked_by ? names.get(b.booked_by) ?? 'Unknown' : null), a => (a.added_by ? names.get(a.added_by) ?? 'Unknown' : null))
      const monthlyMap = new Map<string, { label: string; screenings: number; hires: number }>()
      const mget = (d: Date) => { const k = format(d, 'MMM yyyy'); return monthlyMap.get(k) ?? (monthlyMap.set(k, { label: k, screenings: 0, hires: 0 }), monthlyMap.get(k)!) }
      // seed months in order
      for (let d = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1); d <= dateRange.endDate; d.setMonth(d.getMonth() + 1)) mget(new Date(d))
      screens.forEach(b => mget(new Date(b.created_at)).screenings++)
      hires.forEach(a => mget(eventAt(a)).hires++)

      return { screenings: screens.length, hires: hires.length, byJob, byRecruiter, monthly: [...monthlyMap.values()] }
    },
    enabled: enabled && finalJobIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })
  const s = data?.screenings ?? 0
  const h = data?.hires ?? 0
  return {
    screenings: s, hires: h, ratio: ratioOf(s, h),
    byJob: data?.byJob ?? [], byRecruiter: data?.byRecruiter ?? [], monthly: data?.monthly ?? [],
    isLoading: enabled && finalJobIds.length > 0 && isLoading,
  }
}
