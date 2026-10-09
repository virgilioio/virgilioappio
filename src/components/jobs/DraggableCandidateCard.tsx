import { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface DraggableCandidateCardProps {
  id: string
  children: ReactNode
  isPartOfBulkDrag?: boolean // True if selected while another selected card is being dragged
}

/**
 * Motion & Feel §4 (CLAUDE.md): while a card is picked up, its place in the column
 * stays as a dashed slot of the same size (the lifted copy lives in DragOverlay), so
 * the column never jumps. `touch-action: pan-y` lets a phone scroll the column; a
 * long-press (--delay-longpress) picks the card up.
 */
export default function DraggableCandidateCard({ id, children, isPartOfBulkDrag }: DraggableCandidateCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })

  const style: React.CSSProperties = isDragging
    ? { touchAction: 'pan-y' }
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isPartOfBulkDrag ? 0.5 : 1,
        cursor: 'grab',
        touchAction: 'pan-y',
      }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-board-card={id}
      className={isDragging ? 'gio-board-slot' : undefined}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}
