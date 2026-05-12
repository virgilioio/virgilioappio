import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { GripVertical, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DealStage, DealStageType } from '@/hooks/useDealStages'

const stageTypeVariants: Record<DealStageType, BadgeProps['variant']> = {
  open: 'pastel-blue',
  won: 'success',
  lost: 'secondary',
}

interface DraggableDealStageItemProps {
  stage: DealStage
  onEdit: (stage: DealStage) => void
  onRemove: (stage: DealStage) => void
  isDragging?: boolean
}

export function DraggableDealStageItem({ stage, onEdit, onRemove, isDragging }: DraggableDealStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: (isDragging || isSortableDragging) ? 0 : undefined,
  }

  return (
    <Card ref={setNodeRef} style={style} className="transition-colors hover:bg-surface-secondary/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h5 className={cn('font-medium text-text-primary')}>{stage.name}</h5>
                <Badge variant={stageTypeVariants[stage.stage_type] ?? 'secondary'}>
                  {stage.stage_type}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(stage)
              }}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Edit stage"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(stage)
              }}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Remove stage"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
