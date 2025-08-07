import { cn } from '@/lib/utils'

type DropZoneProps = {
  active: boolean
  size?: 'compact' | 'expanded'
  isEmpty?: boolean
  tintClass?: string // background tint class (e.g., bg-pastel-blue/20) to match column
  className?: string
}

/**
 * Visual drop indicator area that expands for empty stages and
 * pushes content when hovering non-empty stages.
 */
export default function DropZone({ active, size = 'compact', isEmpty, tintClass, className }: DropZoneProps) {
  const baseHeight =
    size === 'expanded'
      ? active ? 'h-40' : 'h-0' // expanded only when dragging over empty column
      : active
        ? 'h-16' // space to push cards down when hovering
        : 'h-0'  // no space when not active

  const bgClass = isEmpty
    ? (tintClass ?? 'bg-transparent') // match column tint for empty columns
    : (active ? (tintClass ?? 'bg-primary/25') : 'bg-transparent')

  const borderClass = active ? 'border border-primary/40' : 'border-0'

  return (
    <div
      aria-label="Drop candidate here"
      className={cn(
        'rounded-lg transition-all duration-200',
        borderClass,
        bgClass,
        baseHeight,
        className
      )}
    />
  )
}
