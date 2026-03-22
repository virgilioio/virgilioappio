import { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface DraggableCandidateCardProps {
  id: string
  children: ReactNode
  isPartOfBulkDrag?: boolean // True if selected while another selected card is being dragged
}

export default function DraggableCandidateCard({ id, children, isPartOfBulkDrag }: DraggableCandidateCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : (isPartOfBulkDrag ? 0.5 : 1),
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: isDragging ? undefined : 'transform 200ms ease, opacity 150ms ease',
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  )
}
