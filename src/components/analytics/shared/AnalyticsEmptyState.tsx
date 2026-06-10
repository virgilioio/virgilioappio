import { EmptyState } from '@/components/ui/empty-state'
import { SoftChart } from '@/components/ui/EmptyIllustrations'

interface AnalyticsEmptyStateProps {
  title?: string
  description?: string
  className?: string
}

/**
 * @deprecated Use <EmptyState size="card" illustration={<SoftChart />}> directly.
 * Thin wrapper that renders the canonical card-size empty with the SoftChart scene.
 */
export function AnalyticsEmptyState({
  title = 'No data yet',
  description = 'This chart fills in as candidates move through your pipeline.',
  className,
}: AnalyticsEmptyStateProps) {
  return (
    <EmptyState
      size="card"
      illustration={<SoftChart />}
      title={title}
      body={description}
      className={className}
    />
  )
}
