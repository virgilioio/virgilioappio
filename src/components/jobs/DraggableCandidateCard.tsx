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

  const style: React.CSSProperties = isDragging
    ? { height: 0, overflow: 'hidden', margin: 0, padding: 0, opacity: 0 }
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isPartOfBulkDrag ? 0.5 : 1,
        cursor: 'grab',
      }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  )
}
