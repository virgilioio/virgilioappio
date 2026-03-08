import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { DateRange } from '@/hooks/useAnalyticsMetrics'

export interface OfferAnalyticsData {
  offersSent: number
  offersConverted: number
  conversionRate: number | null
  avgOfferToHireDays: number | null
  isLoading: boolean
  error: Error | null
}

export function useOfferAnalyticsMetrics(
  finalJobIds: string[],
  dateRange: DateRange,
  enabled: boolean
): OfferAnalyticsData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-offer', finalJobIds.join(','), dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: async () => {
      if (finalJobIds.length === 0) return { offersSent: 0, offersConverted: 0, conversionRate: null, avgOfferToHireDays: null }

      const startISO = dateRange.startDate.toISOString()
      const endISO = dateRange.endDate.toISOString()

      const { data: assocs, error: aErr } = await supabase
        .from('job_candidate_associations')
        .select('id, status, offered_at, updated_at')
        .in('job_id', finalJobIds)
        .not('offered_at', 'is', null)
      if (aErr) throw aErr

      // Offers sent in date range
      const offersInRange = (assocs || []).filter(a => {
        return a.offered_at && a.offered_at >= startISO && a.offered_at <= endISO
      })
      const offersSent = offersInRange.length

      // Offers that converted to hired
      const converted = offersInRange.filter(a => a.status === 'hired')
      const offersConverted = converted.length

      const conversionRate = offersSent > 0 ? Math.round((offersConverted / offersSent) * 100) : null

      // Avg time from offer to hire
      let avgOfferToHireDays: number | null = null
      if (converted.length > 0) {
        const totalDays = converted.reduce((sum, a) => {
          const offerDate = new Date(a.offered_at!).getTime()
          const hireDate = new Date(a.updated_at).getTime()
          return sum + (hireDate - offerDate) / (1000 * 60 * 60 * 24)
        }, 0)
        avgOfferToHireDays = Math.round(totalDays / converted.length)
      }

      return { offersSent, offersConverted, conversionRate, avgOfferToHireDays }
    },
    enabled: enabled && finalJobIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  return {
    offersSent: data?.offersSent ?? 0,
    offersConverted: data?.offersConverted ?? 0,
    conversionRate: data?.conversionRate ?? null,
    avgOfferToHireDays: data?.avgOfferToHireDays ?? null,
    isLoading,
    error: error as Error | null,
  }
}
