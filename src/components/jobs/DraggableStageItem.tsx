import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JobStage {
  id: string
  stage_name: string
  stage_type: string
  stage_description?: string
  is_default: boolean
  stage_priority?: number | string
}

interface DraggableStageItemProps {
  stage: JobStage
  index: number
  onRemove: (stageId: string) => void
  isDragging?: boolean
}

export function DraggableStageItem({ stage, index, onRemove, isDragging }: DraggableStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: stage.id,
    disabled: stage.is_default, // Disable dragging for default stages
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getStageTypeVariant = (type: string) => {
    switch (type) {
      case 'application': return 'default'
      case 'screening': return 'secondary'
      case 'interview': return 'outline'
      case 'assessment': return 'secondary'
      case 'reference_check': return 'outline'
      case 'offer': return 'default'
      case 'onboarding': return 'secondary'
      default: return 'outline'
    }
  }

  const isDisabled = stage.is_default
  const showDragging = isDragging || isSortableDragging

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-colors",
        isDisabled ? "opacity-60 bg-muted/30" : "hover:bg-surface-secondary/30",
        showDragging && "shadow-lg z-10"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div 
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-md",
                isDisabled 
                  ? "bg-muted text-muted-foreground cursor-not-allowed" 
                  : "bg-primary/10 text-primary cursor-grab active:cursor-grabbing"
              )}
              {...attributes}
              {...listeners}
            >
              {isDisabled ? (
                <div className="flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
              ) : (
                <GripVertical className="h-4 w-4" />
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h5 className={cn(
                  "font-medium",
                  isDisabled ? "text-muted-foreground" : "text-text-primary"
                )}>
                  {stage.stage_name}
                </h5>
                <Badge variant={getStageTypeVariant(stage.stage_type)}>
                  {stage.stage_type.replace('_', ' ')}
                </Badge>
                {stage.is_default && (
                  <Badge variant="secondary">Default</Badge>
                )}
              </div>
              {stage.stage_description && (
                <p className={cn(
                  "text-sm",
                  isDisabled ? "text-muted-foreground" : "text-text-secondary"
                )}>
                  {stage.stage_description}
                </p>
              )}
            </div>
          </div>
          
          {!stage.is_default && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(stage.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}