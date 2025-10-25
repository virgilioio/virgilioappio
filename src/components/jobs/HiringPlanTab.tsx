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
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { supabase } from '@/lib/supabaseClient'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ReadOnlyOverlay } from '@/components/ui/read-only-overlay'
import { StageConfigSheet } from './StageConfigSheet'
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
  readOnly?: boolean
}

export function HiringPlanTab({ jobId, readOnly = false }: HiringPlanTabProps) {
  const { stages, isLoading } = useJobStages()
  const [selectedStages, setSelectedStages] = useState<JobStage[]>([])
  const [availableStages, setAvailableStages] = useState<JobStage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const { isSavingPlan, loadHiringPlan, loadHiringPlanInstances, saveHiringPlan } = useJobHiringPlan()

  // Map of stage_id -> { jhsId, position, customStageName } for current persisted plan
  const [instancesMap, setInstancesMap] = useState<Map<string, { jhsId: string; position: number; customStageName?: string | null }>>(new Map())

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [stagePendingDelete, setStagePendingDelete] = useState<JobStage | null>(null)
  const [pendingDeleteCount, setPendingDeleteCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  
  // Configuration sheet state
  const [configSheetOpen, setConfigSheetOpen] = useState(false)
  const [configJhsId, setConfigJhsId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Helper function to check if a stage has "last" priority
  const isLastPriorityStage = (stage: JobStage) => {
    const p = stage.stage_priority
    return p === 'last' || p === 99 || p === '99' || p === 999 || p === '999'
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

  useEffect(() => {
    if (!jobId) return
    ;(async () => {
      const planStages = await loadHiringPlan(jobId as string)
      if (planStages.length > 0) {
        // Re-enforce priority rules on load: ensure "last" default stages are at the end
        const defaultStages = planStages.filter(s => s.is_default)
        const customStages = planStages.filter(s => !s.is_default)
        const defaultNormalStages = defaultStages.filter(s => !isLastPriorityStage(s))
        const defaultLastStages = defaultStages.filter(s => isLastPriorityStage(s))

        const ordered = [
          ...sortStagesByPriority([...defaultNormalStages]),
          ...customStages,
          ...sortStagesByPriority([...defaultLastStages])
        ]

        const selectedIds = new Set(ordered.map(s => s.id))
        setSelectedStages(ordered)
        setAvailableStages(prev => prev.filter(s => !selectedIds.has(s.id)))
        setHasUnsavedChanges(false)
      } else {
        setHasUnsavedChanges(false)
      }

      // Also load current persisted instances (stage_id -> jhsId, position, customStageName)
      const opts = await loadHiringPlanInstances(jobId as string)
      const map = new Map<string, { jhsId: string; position: number; customStageName?: string | null }>()
      ;(opts || []).forEach(o => map.set(o.stage.id, { jhsId: o.jhsId, position: o.position, customStageName: o.customStageName }))
      setInstancesMap(map)
    })()
  }, [jobId, loadHiringPlan, loadHiringPlanInstances])

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
      setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
    setAvailableStages(prev => prev.filter(s => s.id !== stageId))
    
    toast({
      title: 'Stage Added',
      description: `${stage.stage_name} has been added to the hiring plan`
    })
  }

  const handleRemoveStageRequest = async (stageId: string) => {
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

    setStagePendingDelete(stage)
    setDeleteDialogOpen(true)
    setPendingDeleteCount(null)
    setCountLoading(true)

    try {
      const inst = instancesMap.get(stage.id)
      if (inst?.jhsId) {
        const { count, error } = await supabase
          .from('job_candidate_associations')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('current_stage_id', inst.jhsId)
        if (!error) setPendingDeleteCount(count ?? 0)
        else setPendingDeleteCount(0)
      } else {
        // Not persisted yet -> no candidates in this stage
        setPendingDeleteCount(0)
      }
    } catch (e) {
      setPendingDeleteCount(0)
    } finally {
      setCountLoading(false)
    }
  }

  const handleConfirmRemove = async () => {
    if (!stagePendingDelete) return
    const stage = stagePendingDelete

    const newSelected = selectedStages.filter(s => s.id !== stage.id)

    try {
      await saveHiringPlan(jobId as string, newSelected)

      setSelectedStages(newSelected)
      setAvailableStages(prev => [...prev, stage].sort((a, b) => {
        const aPriority = typeof a.stage_priority === 'number' ? a.stage_priority : 500
        const bPriority = typeof b.stage_priority === 'number' ? b.stage_priority : 500
        return aPriority - bPriority
      }))
      setHasUnsavedChanges(false)

      // Refresh instances map
      const opts = await loadHiringPlanInstances(jobId as string)
      const map = new Map<string, { jhsId: string; position: number; customStageName?: string | null }>()
      ;(opts || []).forEach(o => map.set(o.stage.id, { jhsId: o.jhsId, position: o.position, customStageName: o.customStageName }))
      setInstancesMap(map)

      toast({
        title: 'Stage Removed',
        description: `${stage.stage_name} was removed.${(pendingDeleteCount ?? 0) > 0 ? ` ${(pendingDeleteCount ?? 0)} candidate${(pendingDeleteCount ?? 0) !== 1 ? 's' : ''} moved to the previous stage.` : ''}`
      })
    } finally {
      setDeleteDialogOpen(false)
      setStagePendingDelete(null)
    }
  }

  const handleSaveHiringPlan = async () => {
    if (!jobId) return
    await saveHiringPlan(jobId as string, selectedStages)
    setHasUnsavedChanges(false)
  }
  
  const handleConfigure = (jhsId: string) => {
    setConfigJhsId(jhsId)
    setConfigSheetOpen(true)
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

      <ReadOnlyOverlay active={readOnly} message="Clients can view the hiring plan but cannot edit it.">
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
                    {selectedStages.map((stage, index) => {
                      const instance = instancesMap.get(stage.id)
                      return (
                        <DraggableStageItem
                          key={stage.id}
                          stage={stage}
                          index={index}
                          onRemove={handleRemoveStageRequest}
                          onConfigure={handleConfigure}
                          jhsId={instance?.jhsId}
                          customStageName={instance?.customStageName}
                          isDragging={activeId === stage.id}
                        />
                      )
                    })}
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
      </ReadOnlyOverlay>

      <div className="pt-4 border-t border-border/50">
        <div className="flex justify-between items-center">
          <p className="text-sm text-text-secondary">
            Total stages: {selectedStages.length}
          </p>
          <Button 
            disabled={readOnly || !hasUnsavedChanges || isSavingPlan}
            onClick={handleSaveHiringPlan}
          >
            {isSavingPlan ? 'Saving...' : 'Save Hiring Plan'}
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove stage?</AlertDialogTitle>
            <AlertDialogDescription>
              {stagePendingDelete && (
                <div>
                  Are you sure you want to remove "{stagePendingDelete.stage_name}" from this hiring plan?
                  {countLoading ? (
                    <div className="mt-2">Checking candidates...</div>
                  ) : (pendingDeleteCount ?? 0) > 0 ? (
                    <div className="mt-2">
                      {(pendingDeleteCount ?? 0)} candidate{(pendingDeleteCount ?? 0) !== 1 ? 's' : ''} currently in this stage will be moved to the previous stage.
                    </div>
                  ) : (
                    <div className="mt-2">No candidates are currently in this stage.</div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove}>
              Remove stage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StageConfigSheet
        open={configSheetOpen}
        onOpenChange={setConfigSheetOpen}
        jhsId={configJhsId}
        jobId={jobId}
      />
    </div>
  )
}
