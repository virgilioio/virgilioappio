import { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface DroppableColumnProps {
  id: string
  children?: ReactNode
  isCustomizing: boolean
}

export function DroppableColumn({ id, children, isCustomizing }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  // When used as a hidden drop target (no children), render a visually hidden element
  if (!children) {
    return <div ref={setNodeRef} className="absolute inset-0 pointer-events-none" />
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-6 min-h-[100px] rounded-lg transition-colors duration-200",
        isOver && isCustomizing && "bg-primary/5"
      )}
    >
      {children}
    </div>
  )
}
