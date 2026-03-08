import { AnalyticsSection } from '@/components/analytics/shared/AnalyticsSection'
import { MetricCard } from '@/components/ui/metric-card'
import { MetricCardGroup } from '@/components/ui/metric-card-group'
import { AnalyticsEmptyState } from '@/components/analytics/shared/AnalyticsEmptyState'
import { Gift } from 'lucide-react'
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
        <MetricCardGroup>
          <MetricCard variant="inline" title="Offers Sent" value={data.offersSent} tooltip="Candidates with offered_at in selected period" isLoading={data.isLoading} />
          <MetricCard variant="inline" title="Converted" value={data.offersConverted} tooltip="Offers that resulted in a hire" isLoading={data.isLoading} />
          <MetricCard variant="inline" title="Conversion Rate" value={data.conversionRate} suffix="%" tooltip="Offers that converted to hires / total offers" isLoading={data.isLoading} />
          <MetricCard variant="inline" title="Avg Offer→Hire" value={data.avgOfferToHireDays} suffix="d" tooltip="Average days from offer to hire" isLoading={data.isLoading} />
        </MetricCardGroup>
      )}
    </AnalyticsSection>
  )
}
