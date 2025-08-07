import { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface DroppableStageProps {
  id: string
  className?: string
  children: ReactNode
}

export default function DroppableStage({ id, className, children }: DroppableStageProps) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        'transition-colors',
        isOver && 'outline outline-2 outline-primary/40'
      )}
    >
      {children}
    </div>
  )
}
