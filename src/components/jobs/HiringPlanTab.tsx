import { useState, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useJobStages } from '@/hooks/useJobStages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Plus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { DraggableStageItem } from './DraggableStageItem'

interface JobStage {
  id: string
  stage_name: string
  stage_type: string
  stage_description?: string
  is_default: boolean
  stage_priority?: number | string
}

interface HiringPlanTabProps {
  jobId: string
}

export function HiringPlanTab({ jobId }: HiringPlanTabProps) {
  const { stages, isLoading } = useJobStages()
  const [selectedStages, setSelectedStages] = useState<JobStage[]>([])
  const [availableStages, setAvailableStages] = useState<JobStage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Helper function to check if a stage has "last" priority
  const isLastPriorityStage = (stage: JobStage) => {
    return stage.stage_priority === "last" || stage.stage_priority === 999 || stage.stage_priority === "999"
  }

  // Helper function to sort stages with proper priority handling
  const sortStagesByPriority = (stages: JobStage[]) => {
    return stages.sort((a, b) => {
      const aPriority = a.stage_priority
      const bPriority = b.stage_priority
      
      // Handle "last" priority stages
      if (isLastPriorityStage(a) && !isLastPriorityStage(b)) return 1
      if (!isLastPriorityStage(a) && isLastPriorityStage(b)) return -1
      if (isLastPriorityStage(a) && isLastPriorityStage(b)) return 0
      
      // For non-"last" stages, sort by numeric priority
      const aValue = typeof aPriority === 'number' ? aPriority : (aPriority ? 500 : 500)
      const bValue = typeof bPriority === 'number' ? bPriority : (bPriority ? 500 : 500)
      
      return aValue - bValue
    })
  }

  // Initialize with default stages sorted by priority
  useEffect(() => {
    if (stages.length > 0) {
      const defaultStages = sortStagesByPriority(stages.filter(stage => stage.is_default))
      setSelectedStages(defaultStages)
      setAvailableStages(stages.filter(stage => !stage.is_default))
    }
  }, [stages])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    if (active.id !== over.id) {
      setSelectedStages((stages) => {
        // Separate stages by category
        const defaultStages = stages.filter(stage => stage.is_default)
        const customStages = stages.filter(stage => !stage.is_default)

        // Find stages with "last" priority
        const defaultNormalStages = defaultStages.filter(stage => !isLastPriorityStage(stage))
        const defaultLastStages = defaultStages.filter(stage => isLastPriorityStage(stage))

        const oldIndex = customStages.findIndex(stage => stage.id === active.id)
        const newIndex = customStages.findIndex(stage => stage.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return stages

        const reorderedCustom = arrayMove(customStages, oldIndex, newIndex)
        
        // Combine: normal priority defaults + custom stages + "last" priority defaults
        return [
          ...sortStagesByPriority(defaultNormalStages),
          ...reorderedCustom,
          ...sortStagesByPriority(defaultLastStages)
        ]
      })
    }
  }

  const handleAddStage = (stageId: string) => {
    const stage = availableStages.find(s => s.id === stageId)
    if (!stage) return

    setSelectedStages(prev => {
      // Separate existing stages by category
      const defaultStages = prev.filter(s => s.is_default)
      const customStages = prev.filter(s => !s.is_default)

      // Find stages with "last" priority
      const defaultNormalStages = defaultStages.filter(s => !isLastPriorityStage(s))
      const defaultLastStages = defaultStages.filter(s => isLastPriorityStage(s))

      // Add new stage to custom stages (it will be positioned between normal and "last")
      return [
        ...sortStagesByPriority(defaultNormalStages),
        ...customStages,
        stage, // Add new stage here
        ...sortStagesByPriority(defaultLastStages)
      ]
    })
    
    setAvailableStages(prev => prev.filter(s => s.id !== stageId))
    
    toast({
      title: 'Stage Added',
      description: `${stage.stage_name} has been added to the hiring plan`
    })
  }

  const handleRemoveStage = (stageId: string) => {
    const stage = selectedStages.find(s => s.id === stageId)
    if (!stage) return

    // Don't allow removing default stages
    if (stage.is_default) {
      toast({
        title: 'Cannot Remove Stage',
        description: 'Default stages cannot be removed from the hiring plan',
        variant: 'destructive'
      })
      return
    }

    setSelectedStages(prev => prev.filter(s => s.id !== stageId))
    setAvailableStages(prev => [...prev, stage].sort((a, b) => {
      const aPriority = typeof a.stage_priority === 'number' ? a.stage_priority : 500
      const bPriority = typeof b.stage_priority === 'number' ? b.stage_priority : 500
      return aPriority - bPriority
    }))
    
    toast({
      title: 'Stage Removed',
      description: `${stage.stage_name} has been removed from the hiring plan`
    })
  }

  if (isLoading) {
    return <div>Loading stages...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-2">Hiring Plan</h3>
        <p className="text-sm text-text-secondary mb-4">
          Customize the hiring process for this job. Default stages (grayed out) are fixed in priority order. Stages marked as "last" priority will always appear at the end, with custom stages positioned before them.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-base font-medium text-text-primary mb-3">Current Hiring Stages</h4>
          {selectedStages.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-text-secondary">No stages in the hiring plan</p>
              </CardContent>
            </Card>
          ) : (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={selectedStages.filter(stage => !stage.is_default).map(stage => stage.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {selectedStages.map((stage, index) => (
                    <DraggableStageItem
                      key={stage.id}
                      stage={stage}
                      index={index}
                      onRemove={handleRemoveStage}
                      isDragging={activeId === stage.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {availableStages.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-base font-medium text-text-primary mb-3">Add Additional Stages</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <SearchableSelect
                    value=""
                    onValueChange={handleAddStage}
                    options={availableStages.map(stage => ({
                      value: stage.id,
                      label: stage.stage_name,
                      description: stage.stage_description
                    }))}
                    placeholder="Select a stage to add..."
                    searchPlaceholder="Search stages..."
                  />
                </div>
                <Plus className="h-4 w-4 text-text-secondary" />
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Available stages from the Stages Library
              </p>
            </div>
          </>
        )}
      </div>

      <div className="pt-4 border-t border-border/50">
        <div className="flex justify-between items-center">
          <p className="text-sm text-text-secondary">
            Total stages: {selectedStages.length}
          </p>
          <Button disabled>
            Save Hiring Plan
          </Button>
        </div>
      </div>
    </div>
  )
}