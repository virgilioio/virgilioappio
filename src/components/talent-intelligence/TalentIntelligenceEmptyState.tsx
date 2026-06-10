import { EmptyState } from '@/components/ui/empty-state'
import { SoftPeople } from '@/components/ui/EmptyIllustrations'

interface TalentIntelligenceEmptyStateProps {
  message?: string
}

/**
 * @deprecated Use <EmptyState size="card" illustration={<SoftPeople />}> directly.
 */
export function TalentIntelligenceEmptyState({
  message = 'No data available yet',
}: TalentIntelligenceEmptyStateProps) {
  return (
    <EmptyState
      size="card"
      illustration={<SoftPeople />}
      title={message}
    />
  )
}
