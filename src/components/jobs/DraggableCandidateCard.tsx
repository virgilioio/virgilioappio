import { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface DraggableCandidateCardProps {
  id: string
  children: ReactNode
}

export default function DraggableCandidateCard({ id, children }: DraggableCandidateCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })

  const transformString = transform
    ? `${CSS.Translate.toString(transform)} rotate(-2deg) scale(1.02)`
    : (isDragging ? 'rotate(-2deg) scale(1.02)' : undefined)

  const style: React.CSSProperties = {
    transform: transformString,
    cursor: isDragging ? 'grabbing' : 'grab',
    boxShadow: isDragging ? '0 12px 28px rgba(0,0,0,0.12)' : undefined,
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
    zIndex: isDragging ? 40 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  )
}

