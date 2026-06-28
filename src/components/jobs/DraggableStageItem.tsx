import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Trash2, Settings } from 'lucide-react'
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
  /** Receives the instance id (jhsId or temp client id) of the row being removed. */
  onRemove: (instanceId: string) => void
  onConfigure?: (jhsId: string) => void
  /** Stable id for this row in the plan (persisted jhsId or temp client id). Used as DnD identity. */
  instanceId: string
  jhsId?: string
  customStageName?: string | null
  isDragging?: boolean
  /** When true, this instance cannot be removed/reordered (e.g. canonical default stage). */
  locked?: boolean
}

export function DraggableStageItem({ stage, index, onRemove, onConfigure, instanceId, jhsId, customStageName, isDragging, locked }: DraggableStageItemProps) {
  const isDisabled = locked ?? stage.is_default
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: instanceId,
    disabled: isDisabled, // Disable dragging for locked stages
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: (isDragging || isSortableDragging) ? 0 : undefined,
  }

  const stageTypeVariants: Record<string, import("@/components/ui/badge").BadgeProps["variant"]> = {
    application: 'pastel-blue',
    screening: 'info',
    interview: 'pastel-purple',
    assessment: 'warning',
    reference_check: 'pastel-orange',
    offer: 'success',
    onboarding: 'pastel-green',
    custom: 'secondary',
  }


  const showDragging = isDragging || isSortableDragging

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-colors",
        isDisabled ? "opacity-60 bg-muted/30" : "hover:bg-surface-secondary/30"
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
                  {customStageName || stage.stage_name}
                </h5>
                <Badge variant={stageTypeVariants[stage.stage_type] ?? 'secondary'}>
                  {stage.stage_type.replace('_', ' ')}
                </Badge>
                {stage.is_default && (
                  <Badge variant="secondary">Default</Badge>
                )}
                {customStageName && (
                  <Badge variant="outline" className="text-xs">Custom Name</Badge>
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
          
          <div className="flex items-center gap-1">
            {/* Configuration button - always visible */}
            {onConfigure && jhsId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onConfigure(jhsId)
                }}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Configure stage"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            
            {/* Delete button - only for non-default stages */}
            {!stage.is_default && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(stage.id)
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Remove stage"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}