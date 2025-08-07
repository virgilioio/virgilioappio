import { cn } from '@/lib/utils'

type DropZoneProps = {
  active: boolean
  size?: 'compact' | 'expanded'
  className?: string
}

/**
 * Visual drop indicator area that expands for empty stages and
 * pushes content when hovering non-empty stages.
 */
export default function DropZone({ active, size = 'compact', className }: DropZoneProps) {
  const baseHeight =
    size === 'expanded'
      ? 'h-40' // large target for empty stages
      : active
        ? 'h-16' // space to push cards down when hovering
        : 'h-0'  // no space when not active

  return (
    <div
      aria-label="Drop candidate here"
      className={cn(
        'rounded-lg transition-all duration-200',
        'border border-primary/25',
        // subtle fill that darkens when active
        active ? 'bg-primary/25' : size === 'expanded' ? 'bg-primary/10' : 'bg-transparent',
        baseHeight,
        className
      )}
    />
  )
}
