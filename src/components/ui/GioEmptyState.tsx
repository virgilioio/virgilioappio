import { EmptyState } from '@/components/ui/empty-state'
import { SoftPlane } from '@/components/ui/EmptyIllustrations'

interface GioEmptyStateProps {
  title: string
  description?: string
  className?: string
}

/**
 * @deprecated Use <EmptyState size="card|route" illustration={...}> directly with the
 * surface-specific illustration from EmptyIllustrations. Kept as a thin fallback that
 * renders the canonical card-size empty with a generic SoftPlane scene.
 */
export function GioEmptyState({ title, description, className }: GioEmptyStateProps) {
  return (
    <EmptyState
      size="card"
      illustration={<SoftPlane />}
      title={title}
      body={description}
      className={className}
    />
  )
}
