/**
 * Ultra-compact one-line candidate row inside the inline mini-kanban.
 * white, radius 7, padding 5×8 — 18px avatar + name + days-in-stage.
 * Idle (>7d) shows amber clock-alert + amber bold days + amber avatar tint.
 */
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ClockAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InlineCandidate {
  id: string // association id (used as draggable id)
  candidateId: string
  name: string
  daysInStage: number
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

export function InlineCandidateRow({
  c,
  onClick,
}: {
  c: InlineCandidate
  onClick?: (candidateId: string) => void
}) {
  const idle = c.daysInStage > 7
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: c.id,
    data: { candidateId: c.candidateId },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDragging) return
        e.stopPropagation()
        onClick?.(c.candidateId)
      }}
      className="flex cursor-grab items-center gap-2 rounded-[7px] bg-white hover:bg-[#FAFAF7]"
      // padding 5×8
      // border-radius 7
      // border 1px #E7E8EE
      // eslint-disable-next-line react/forbid-dom-props
    >
      <div
        className="flex w-full items-center gap-2"
        style={{ padding: '5px 8px', border: '1px solid #EDECE5', borderRadius: 7 }}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full font-poppins',
          )}
          style={{
            width: 18,
            height: 18,
            fontSize: 9,
            fontWeight: 600,
            background: idle ? '#FEF3C7' : '#EDE4FF',
            color: idle ? '#B45309' : '#5B21B6',
          }}
        >
          {initials(c.name)}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-inter text-[#1F2230]"
          style={{ fontSize: 11.5, fontWeight: 500 }}
        >
          {c.name}
        </span>
        {idle ? (
          <ClockAlert size={11} strokeWidth={2} color="#B45309" />
        ) : null}
        <span
          className="font-inter tabular-nums"
          style={{
            fontSize: 10,
            fontWeight: idle ? 600 : 500,
            color: idle ? '#B45309' : '#8B8F9E',
          }}
        >
          {c.daysInStage}d
        </span>
      </div>
    </div>
  )
}
