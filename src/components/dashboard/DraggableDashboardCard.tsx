import { ReactNode } from 'react'
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable'
import type { AnimateLayoutChanges } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DraggableDashboardCardProps {
  id: string
  children: ReactNode
  isCustomizing: boolean
}

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args
  if (isSorting || wasDragging) return false
  return defaultAnimateLayoutChanges(args)
}

export function DraggableDashboardCard({ id, children, isCustomizing }: DraggableDashboardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isCustomizing, animateLayoutChanges })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/card min-w-0">
      {isCustomizing && (
        <button
          className={cn(
            "absolute -top-2 -left-2 z-10 flex items-center justify-center",
            "h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md",
            "cursor-grab active:cursor-grabbing",
            "opacity-0 group-hover/card:opacity-100 transition-opacity duration-200",
            "focus:opacity-100"
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <div className={cn(
        isCustomizing && "ring-1 ring-primary/20 ring-dashed rounded-brand transition-all duration-200"
      )}>
        {children}
      </div>
    </div>
  )
}

/** Static clone used inside DragOverlay */
export function DashboardCardOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        transform: 'rotate(-1.5deg) scale(1.03)',
        boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
      }}
      className="pointer-events-none"
    >
      {children}
    </div>
  )
}
