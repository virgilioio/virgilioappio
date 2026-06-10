import { BarChart3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

interface AnalyticsEmptyStateProps {
  title?: string
  description?: string
  icon?: LucideIcon
  className?: string
}

/**
 * @deprecated Use <EmptyState variant="chart"> from '@/components/ui/empty-state'.
 * Kept as a thin wrapper during the consolidation migration.
 */
export function AnalyticsEmptyState({
  title = 'No data available',
  description = 'Try adjusting your filters or date range',
  icon = BarChart3,
  className,
}: AnalyticsEmptyStateProps) {
  return (
    <EmptyState
      variant="chart"
      title={title}
      description={description}
      icon={icon}
      className={className}
    />
  )
}
