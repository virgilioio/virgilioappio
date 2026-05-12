import { ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

export function DraggableDealCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style: React.CSSProperties = isDragging
    ? { height: 0, overflow: 'hidden', margin: 0, padding: 0, opacity: 0 }
    : { transform: CSS.Translate.toString(transform), cursor: 'grab' }
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  )
}

export function DroppableDealStage({
  id,
  children,
  isEmpty,
  className,
}: {
  id: string
  children: ReactNode
  isEmpty?: boolean
  className?: string
}) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex-1 min-h-[120px] rounded-lg p-2 transition-colors duration-150',
        isOver && 'bg-virgilio-purple/5 ring-1 ring-virgilio-purple/30',
        className
      )}
    >
      {isEmpty && !isOver && (
        <div className="absolute inset-2 rounded-md border border-dashed border-virgilio-border/50 pointer-events-none" />
      )}
      <div className="relative z-10 flex flex-col gap-2">{children}</div>
    </div>
  )
}
