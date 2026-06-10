import { EmptyState } from '@/components/ui/empty-state'

interface GioEmptyStateProps {
  title: string
  description?: string
  className?: string
}

/**
 * @deprecated Use <EmptyState variant="inline"> from '@/components/ui/empty-state'.
 * Kept as a thin wrapper during the consolidation migration.
 */
export function GioEmptyState({ title, description, className = '' }: GioEmptyStateProps) {
  return (
    <EmptyState
      variant="inline"
      title={title}
      description={description}
      className={className}
    />
  )
}
