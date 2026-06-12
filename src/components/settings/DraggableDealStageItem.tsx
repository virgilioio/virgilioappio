import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Pencil } from 'lucide-react'
import type { DealStage, DealStageType } from '@/hooks/useDealStages'

const CHIP: Record<DealStageType, { bg: string; fg: string }> = {
  open: { bg: '#DBEAFE', fg: '#1D4ED8' },
  won:  { bg: '#D1FAE5', fg: '#0B7A57' },
  lost: { bg: '#FEE2E2', fg: '#B91C1C' },
}

interface Props {
  stage: DealStage
  onEdit: (stage: DealStage) => void
  onRemove: (stage: DealStage) => void
  isDragging?: boolean
  isLast?: boolean
}

export function DraggableDealStageItem({ stage, onEdit, onRemove, isDragging, isLast }: Props) {
  const {
    attributes, listeners, setNodeRef, transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: stage.id })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: (isDragging || isSortableDragging) ? 0 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '10px 18px',
    borderBottom: isLast ? 'none' : '1px solid #F1F0EC',
    background: '#FFFFFF',
  }

  const chip = CHIP[stage.stage_type] ?? CHIP.open

  return (
    <div ref={setNodeRef} style={style}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 inline-flex items-center justify-center"
        style={{ cursor: 'grab', background: 'transparent', border: 'none', padding: 0, color: '#B5B9C4' }}
        aria-label="Drag to reorder"
      >
        <GripVertical size={13} strokeWidth={2} />
      </button>

      <span
        className="flex-1 min-w-0 truncate font-inter"
        style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
      >
        {stage.name}
      </span>

      <span
        className="inline-flex items-center font-inter shrink-0"
        style={{
          fontSize: 10, fontWeight: 600,
          padding: '2px 8px', borderRadius: 999,
          backgroundColor: chip.bg, color: chip.fg,
          textTransform: 'lowercase',
        }}
      >
        {stage.stage_type}
      </span>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(stage) }}
        className="shrink-0 inline-flex items-center justify-center transition-colors"
        style={{ background: 'transparent', border: 'none', padding: 4, color: '#8B8F9E', cursor: 'pointer' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#0d0d09')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#8B8F9E')}
        title="Edit stage"
        aria-label="Edit stage"
      >
        <Pencil size={12} strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(stage) }}
        className="shrink-0 inline-flex items-center justify-center transition-colors"
        style={{ background: 'transparent', border: 'none', padding: 4, color: '#8B8F9E', cursor: 'pointer' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#B91C1C')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#8B8F9E')}
        title="Remove stage"
        aria-label="Remove stage"
      >
        <Trash2 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}
