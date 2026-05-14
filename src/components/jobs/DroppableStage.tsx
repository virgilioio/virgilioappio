import { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface DroppableStageProps {
  id: string
  className?: string
  children: ReactNode
  isEmpty?: boolean
  /** Tailwind classes for the column tint while a card is being dragged over it.
   *  e.g. "bg-pastel-blue/30 ring-info/40 border-info/50" */
  hoverShellClasses?: string
}

export default function DroppableStage({
  id,
  className,
  children,
  isEmpty,
  hoverShellClasses,
}: DroppableStageProps) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex-1 rounded-2xl border border-virgilio-border/60 bg-[#FAFAF7] p-2 transition-colors duration-150',
        isOver && (hoverShellClasses || 'bg-virgilio-purple/5 ring-1 ring-inset ring-virgilio-purple/30'),
        className
      )}
    >
      {/* Inset dashed dropzone outline shown only on hover */}
      {isOver && (
        <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-dashed border-virgilio-purple/40" />
      )}
      {/* Empty-column placeholder (when not hovering) */}
      {isEmpty && !isOver && (
        <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-dashed border-virgilio-border/50" />
      )}
      <div className="relative z-10 min-h-[120px]">{children}</div>
    </div>
  )
}
