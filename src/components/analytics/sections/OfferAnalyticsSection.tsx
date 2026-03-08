import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { AnalyticsKpiCard } from '@/components/analytics/shared/AnalyticsKpiCard'
import { AnalyticsEmptyState } from '@/components/analytics/shared/AnalyticsEmptyState'
import { Gift, UserCheck, Percent, Clock } from 'lucide-react'
import type { OfferAnalyticsData } from '@/hooks/analytics/useOfferAnalyticsMetrics'

interface OfferAnalyticsSectionProps {
  data: OfferAnalyticsData
}

export function OfferAnalyticsSection({ data }: OfferAnalyticsSectionProps) {
  const isEmpty = data.offersSent === 0 && !data.isLoading

  return (
    <AnalyticsSection
      title="Offer Analytics"
      subtitle="Offer volume, acceptance, and time to conversion"
      icon={Gift}
    >
      {isEmpty ? (
        <AnalyticsEmptyState
          icon={Gift}
          title="No offers in this period"
          description="Offers are tracked via the offered_at timestamp on candidate associations"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AnalyticsKpiCard title="Offers Sent" value={data.offersSent} icon={Gift} tooltip="Candidates with offered_at in selected period" isLoading={data.isLoading} />
          <AnalyticsKpiCard title="Converted to Hire" value={data.offersConverted} icon={UserCheck} tooltip="Offers that resulted in a hire" isLoading={data.isLoading} />
          <AnalyticsKpiCard title="Conversion Rate" value={data.conversionRate} icon={Percent} suffix="%" tooltip="Offers that converted to hires / total offers" isLoading={data.isLoading} />
          <AnalyticsKpiCard title="Avg Offer→Hire" value={data.avgOfferToHireDays} icon={Clock} suffix="d" tooltip="Average days from offer to hire" isLoading={data.isLoading} />
        </div>
      )}
    </AnalyticsSection>
  )
}
