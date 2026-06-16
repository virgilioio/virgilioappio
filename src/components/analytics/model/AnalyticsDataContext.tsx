import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAnalyticsMetrics, type DateRange } from '@/hooks/useAnalyticsMetrics'
import { useStagePerformanceMetrics } from '@/hooks/analytics/useStagePerformanceMetrics'
import { useJobHealthMetrics } from '@/hooks/analytics/useJobHealthMetrics'
import { useRecruiterPerformanceMetrics } from '@/hooks/analytics/useRecruiterPerformanceMetrics'
import { useSourcePerformanceMetrics } from '@/hooks/analytics/useSourcePerformanceMetrics'
import { useInterviewHealthMetrics } from '@/hooks/analytics/useInterviewHealthMetrics'
import { useOfferAnalyticsMetrics } from '@/hooks/analytics/useOfferAnalyticsMetrics'
import { useTalentInsightsMetrics } from '@/hooks/analytics/useTalentInsightsMetrics'

export interface PageFilters {
  recruiterIds: string[]
  jobIds: string[]
  organizationIds: string[]
  jobStatus: string
}

interface ProviderProps {
  dateRange: DateRange
  filters: PageFilters
  children: ReactNode
}

export interface AnalyticsBundle {
  dateRange: DateRange
  metrics: ReturnType<typeof useAnalyticsMetrics>
  stage: ReturnType<typeof useStagePerformanceMetrics>
  jobHealth: ReturnType<typeof useJobHealthMetrics>
  recruiter: ReturnType<typeof useRecruiterPerformanceMetrics>
  source: ReturnType<typeof useSourcePerformanceMetrics>
  interview: ReturnType<typeof useInterviewHealthMetrics>
  offer: ReturnType<typeof useOfferAnalyticsMetrics>
  talent: ReturnType<typeof useTalentInsightsMetrics>
}

const Ctx = createContext<AnalyticsBundle | null>(null)

export function AnalyticsDataProvider({ dateRange, filters, children }: ProviderProps) {
  const metrics = useAnalyticsMetrics({ dateRange, ...filters })
  const hasJobIds = metrics.finalJobIds.length > 0 && !metrics.isLoading
  const stage = useStagePerformanceMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const jobHealth = useJobHealthMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const recruiter = useRecruiterPerformanceMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const source = useSourcePerformanceMetrics(metrics.finalJobIds, hasJobIds)
  const interview = useInterviewHealthMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const offer = useOfferAnalyticsMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const talent = useTalentInsightsMetrics(metrics.finalJobIds, hasJobIds)

  const value = useMemo<AnalyticsBundle>(
    () => ({ dateRange, metrics, stage, jobHealth, recruiter, source, interview, offer, talent }),
    [dateRange, metrics, stage, jobHealth, recruiter, source, interview, offer, talent],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAnalyticsBundle(): AnalyticsBundle {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAnalyticsBundle must be used inside AnalyticsDataProvider')
  return v
}
