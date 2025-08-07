import { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import DropZone from './DropZone'

interface DroppableStageProps {
  id: string
  className?: string
  children: ReactNode
  isEmpty?: boolean
  tintClass?: string
}

export default function DroppableStage({ id, className, children, isEmpty, tintClass }: DroppableStageProps) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        'transition-colors relative'
      )}
    >
      <DropZone active={isOver} size={isEmpty ? 'expanded' : 'compact'} isEmpty={isEmpty} tintClass={tintClass} />
      <div className={cn('relative z-10')}>
        {children}
      </div>
    </div>
  )
}
