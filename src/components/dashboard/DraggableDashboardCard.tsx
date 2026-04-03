import { ReactNode } from 'react'
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable'
import type { AnimateLayoutChanges } from '@dnd-kit/sortable'

import { GripVertical, X, Columns2, Columns3, Columns4 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WidgetSize, WIDGET_REGISTRY, DashboardCardId, CARD_SIZE_RULES } from '@/hooks/useDashboardLayout'

export type DropPosition = 'before' | 'after' | null

interface DraggableDashboardCardProps {
  id: string
  children: ReactNode
  isCustomizing: boolean
  currentSize: WidgetSize
  dropPosition?: DropPosition
  onHide?: () => void
  onCycleSize?: () => void
}

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args
  if (isSorting || wasDragging) return false
  return defaultAnimateLayoutChanges(args)
}

const SIZE_ICONS: Record<WidgetSize, typeof Columns2> = {
  xsmall: Columns2,
  small: Columns2,
  medium: Columns3,
  large: Columns4,
}

const SIZE_LABELS: Record<WidgetSize, string> = {
  xsmall: '1 col',
  small: '2 cols',
  medium: '3 cols',
  large: '4 cols',
}

export function DraggableDashboardCard({
  id,
  children,
  isCustomizing,
  currentSize,
  dropPosition,
  onHide,
  onCycleSize,
}: DraggableDashboardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id,
    disabled: !isCustomizing,
    animateLayoutChanges,
  })

  const meta = WIDGET_REGISTRY[id as DashboardCardId]
  const isResizable = meta && !meta.fixed && meta.allowedSizes.length > 1

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : undefined,
    scale: isDragging ? '0.97' : undefined,
    transition: 'opacity 200ms ease, scale 200ms ease',
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/card min-w-0">
      {/* Drop position indicators */}
      {isCustomizing && dropPosition === 'before' && !isDragging && (
        <div className="absolute -top-[3px] left-0 right-0 z-20 h-[3px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
      )}
      {isCustomizing && dropPosition === 'after' && !isDragging && (
        <div className="absolute -bottom-[3px] left-0 right-0 z-20 h-[3px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
      )}

      {isCustomizing && (
        <>
          {/* Drag handle */}
           <button
             className={cn(
               "absolute -top-2 -left-2 z-10 flex items-center justify-center",
               "h-7 w-7 rounded-full bg-muted text-muted-foreground shadow-sm border border-border",
               "cursor-grab active:cursor-grabbing",
               "transition-colors duration-200",
               "focus:ring-2 focus:ring-ring"
             )}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          {/* Size cycle button */}
          {isResizable && onCycleSize && (
            <button
              onClick={onCycleSize}
             className={cn(
                "absolute -top-2 left-7 z-10 flex items-center gap-1 px-2",
                "h-7 rounded-full shadow-sm border border-border",
                "bg-muted text-muted-foreground",
                "cursor-pointer text-[10px] font-medium",
                "transition-colors duration-200",
                "hover:bg-accent hover:text-accent-foreground"
              )}
              title={`Current: ${SIZE_LABELS[currentSize]}. Click to cycle.`}
            >
              {(() => {
                const Icon = SIZE_ICONS[currentSize]
                return <Icon className="h-3.5 w-3.5" />
              })()}
              <span>{SIZE_LABELS[currentSize]}</span>
            </button>
          )}

          {/* Hide button */}
          {onHide && (
            <button
              onClick={onHide}
             className={cn(
                "absolute -top-2 -right-2 z-10 flex items-center justify-center",
                "h-7 w-7 rounded-full bg-muted text-destructive shadow-sm border border-border",
                "cursor-pointer",
                "transition-colors duration-200",
                "hover:bg-destructive hover:text-destructive-foreground"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
      <div className={cn(
        isCustomizing && "ring-1 ring-dashed rounded-brand transition-all duration-200 ring-border/40",
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
