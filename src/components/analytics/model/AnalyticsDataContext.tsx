import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAnalyticsMetrics, type DateRange } from '@/hooks/useAnalyticsMetrics'
import { useStagePerformanceMetrics } from '@/hooks/analytics/useStagePerformanceMetrics'
import { useJobHealthMetrics } from '@/hooks/analytics/useJobHealthMetrics'
import { useRecruiterPerformanceMetrics } from '@/hooks/analytics/useRecruiterPerformanceMetrics'
import { useSourcePerformanceMetrics } from '@/hooks/analytics/useSourcePerformanceMetrics'
import { useInterviewHealthMetrics } from '@/hooks/analytics/useInterviewHealthMetrics'
import { useOfferAnalyticsMetrics } from '@/hooks/analytics/useOfferAnalyticsMetrics'
import { useTalentInsightsMetrics } from '@/hooks/analytics/useTalentInsightsMetrics'
import { useCrmAnalyticsMetrics, type CrmFilters } from '@/hooks/analytics/useCrmAnalyticsMetrics'

export interface PageFilters {
  recruiterIds: string[]
  jobIds: string[]
  organizationIds: string[]
  jobStatus: string
  // CRM filter slice (optional — defaults to empty)
  dealOwnerIds?: string[]
  dealCompanyIds?: string[]
  dealStageIds?: string[]
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
  crm: ReturnType<typeof useCrmAnalyticsMetrics>
}

const Ctx = createContext<AnalyticsBundle | null>(null)

export function AnalyticsDataProvider({ dateRange, filters, children }: ProviderProps) {
  const metrics = useAnalyticsMetrics({ dateRange, ...filters })
  const hasJobIds = metrics.finalJobIds.length > 0 && !metrics.isLoading
  const stage = useStagePerformanceMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const jobHealth = useJobHealthMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const recruiter = useRecruiterPerformanceMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const source = useSourcePerformanceMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const interview = useInterviewHealthMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const offer = useOfferAnalyticsMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const talent = useTalentInsightsMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const crmFilters: CrmFilters = {
    ownerIds: filters.dealOwnerIds,
    companyIds: filters.dealCompanyIds,
    stageIds: filters.dealStageIds,
  }
  const crm = useCrmAnalyticsMetrics(dateRange, crmFilters)

  const value = useMemo<AnalyticsBundle>(
    () => ({ dateRange, metrics, stage, jobHealth, recruiter, source, interview, offer, talent, crm }),
    [dateRange, metrics, stage, jobHealth, recruiter, source, interview, offer, talent, crm],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAnalyticsBundle(): AnalyticsBundle {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAnalyticsBundle must be used inside AnalyticsDataProvider')
  return v
}

