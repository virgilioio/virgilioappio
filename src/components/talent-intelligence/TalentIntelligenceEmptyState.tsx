import { EmptyState } from '@/components/ui/empty-state'

interface TalentIntelligenceEmptyStateProps {
  message?: string
}

/**
 * @deprecated Use <EmptyState variant="inline"> from '@/components/ui/empty-state'.
 * Kept as a thin wrapper during the consolidation migration.
 */
export function TalentIntelligenceEmptyState({
  message = 'No data available yet for this visualization',
}: TalentIntelligenceEmptyStateProps) {
  return <EmptyState variant="inline" title={message} mascot={false} />
}
