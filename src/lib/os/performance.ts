import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'

/**
 * Performance on the Work tab (member profile step 4, 2026-10-23): one
 * person's hires, candidates added, interviews and offers over a period,
 * counted on the server by os_person_performance (the person and admins only).
 */

export type PerformancePeriod = '90d' | 'year' | 'all'

export const PERIOD_LABEL: Record<PerformancePeriod, string> = {
  '90d': 'Last 90 days',
  year: 'This year',
  all: 'All time',
}

export interface PerformanceJob {
  job_id: string
  title: string
  client: string | null
  status: string | null
  added: number
  interviews: number
  offers: number
  hires: number
}

export interface Performance {
  hires: number
  hires_as_sourcer: number
  hires_as_recruiter: number
  fill_days_median: number | null
  added: number
  interviews: number
  offers: number
  funnel: { added: number; interviewed: number; offered: number; hired: number }
  uncredited_fills: number
  by_job: PerformanceJob[]
}

export function periodRange(p: PerformancePeriod, now = new Date()): { from: string; to: string } {
  const to = new Date(now.getTime() + 86_400_000).toISOString()
  if (p === 'all') return { from: '2000-01-01T00:00:00Z', to }
  if (p === 'year') return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to }
  return { from: new Date(now.getTime() - 90 * 86_400_000).toISOString(), to }
}

export function usePersonPerformance(tenantId: string | undefined, userId: string | null | undefined, period: PerformancePeriod) {
  return useQuery({
    queryKey: ['os-performance', tenantId, userId, period],
    enabled: !!tenantId && !!userId,
    // A period change keeps the old numbers on screen so they blend into the new ones (§6).
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Performance> => {
      const { from, to } = periodRange(period)
      const { data, error } = await supabase.rpc('os_person_performance', {
        _tenant_id: tenantId!,
        _user_id: userId!,
        _from: from,
        _to: to,
      })
      if (error) throw error
      return data as unknown as Performance
    },
  })
}

/** "15%" of a whole, or null when there's nothing to divide. */
export const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : null)
