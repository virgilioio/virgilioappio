import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface EmptyGridCellProps {
  col: number
  row: number
  isDragActive: boolean
}

export function EmptyGridCell({ col, row, isDragActive }: EmptyGridCellProps) {
  const droppableId = `empty-${col}-${row}`
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'empty-cell', col, row },
  })

  if (!isDragActive) return null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg transition-all duration-200 pointer-events-auto',
        isOver
          ? 'border-2 border-dashed border-primary/50 bg-primary/10'
          : 'border-2 border-dashed border-transparent hover:border-muted-foreground/20',
      )}
      style={{ width: '100%', height: '100%', minHeight: 60 }}
    />
  )
}
