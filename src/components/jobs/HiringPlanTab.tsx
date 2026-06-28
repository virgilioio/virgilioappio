import { useState, useEffect } from 'react'
import { InlineEmpty } from '@/components/ui/empty-state'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useJobStages } from '@/hooks/useJobStages'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Plus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { DraggableStageItem } from './DraggableStageItem'
import { useJobHiringPlan, type HiringPlanInput } from '@/hooks/useJobHiringPlan'
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
import { Skeleton } from '@/components/ui/skeleton'

interface JobStage {
  id: string
  stage_name: string
  stage_type: string
  stage_description?: string
  is_default: boolean
  stage_priority?: number | string
}

interface PlanRow {
  /** Stable identity used in DnD and React keys (jhsId when persisted, otherwise a tmp client id). */
  instanceId: string
  /** Persisted job_hiring_stages.id, when the row has already been saved. */
  jhsId?: string
  stage: JobStage
  customStageName?: string | null
  /** True when this is the canonical (first) default stage occurrence — cannot be removed. */
  locked: boolean
}

interface HiringPlanTabProps {
  jobId: string
  readOnly?: boolean
  hideHeader?: boolean
}

const newTempId = () => `tmp-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))}`

export function HiringPlanTab({ jobId, readOnly = false, hideHeader = false }: HiringPlanTabProps) {
  const { stages, isLoading } = useJobStages()
  const [planRows, setPlanRows] = useState<PlanRow[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const { isSavingPlan, loadHiringPlanInstances, saveHiringPlan } = useJobHiringPlan()

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [rowPendingDelete, setRowPendingDelete] = useState<PlanRow | null>(null)
  const [pendingDeleteCount, setPendingDeleteCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  // Configuration sheet state
  const [configSheetOpen, setConfigSheetOpen] = useState(false)
  const [configJhsId, setConfigJhsId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const isLastPriorityStage = (stage: JobStage) => {
    const p = stage.stage_priority
    return p === 'last' || p === 99 || p === '99' || p === 999 || p === '999'
  }

  const sortStagesByPriority = (list: JobStage[]) => {
    return [...list].sort((a, b) => {
      if (isLastPriorityStage(a) && !isLastPriorityStage(b)) return 1
      if (!isLastPriorityStage(a) && isLastPriorityStage(b)) return -1
      if (isLastPriorityStage(a) && isLastPriorityStage(b)) return 0
      const aValue = typeof a.stage_priority === 'number' ? a.stage_priority : 500
      const bValue = typeof b.stage_priority === 'number' ? b.stage_priority : 500
      return aValue - bValue
    })
  }

  // Initialization
  useEffect(() => {
    if (!jobId || !stages.length || isLoading) return

    setIsInitialized(false)
    setPlanRows([])

    const init = async () => {
      try {
        const instances = await loadHiringPlanInstances(jobId)

        let rows: PlanRow[]
        if (instances.length > 0) {
          // Lock the FIRST occurrence of each default stage (cannot be removed)
          const seenDefaultStageIds = new Set<string>()
          rows = instances.map((inst) => {
            let locked = false
            if (inst.stage.is_default && !seenDefaultStageIds.has(inst.stage.id)) {
              locked = true
              seenDefaultStageIds.add(inst.stage.id)
            }
            return {
              instanceId: inst.jhsId,
              jhsId: inst.jhsId,
              stage: inst.stage as JobStage,
              customStageName: inst.customStageName,
              locked,
            }
          })
        } else {
          // No custom plan yet — seed with library defaults, sorted by priority
          const defaults = sortStagesByPriority(stages.filter((s) => s.is_default))
          rows = defaults.map((s) => ({
            instanceId: newTempId(),
            stage: s as JobStage,
            locked: true,
          }))
        }

        setPlanRows(rows)
        setIsInitialized(true)
        setHasUnsavedChanges(false)
      } catch (error) {
        console.error('Error initializing hiring plan:', error)
        setIsInitialized(true)
      }
    }

    init()
  }, [jobId, stages, isLoading, loadHiringPlanInstances])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    setPlanRows((rows) => {
      // Reorder among the non-locked rows; locked rows keep their slots
      const oldIndex = rows.findIndex((r) => r.instanceId === active.id)
      const newIndex = rows.findIndex((r) => r.instanceId === over.id)
      if (oldIndex === -1 || newIndex === -1) return rows
      if (rows[oldIndex].locked || rows[newIndex].locked) return rows
      return arrayMove(rows, oldIndex, newIndex)
    })
    setHasUnsavedChanges(true)
  }

  const handleAddStage = (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return

    setPlanRows((prev) => {
      const next = [...prev]
      const newRow: PlanRow = {
        instanceId: newTempId(),
        stage: stage as JobStage,
        // Adding from picker never produces a "locked" row — only the original seeded default instance is locked.
        locked: false,
      }
      // Insert before the first trailing "last priority" locked default, otherwise append.
      const trailingIdx = next.findIndex((r) => r.locked && isLastPriorityStage(r.stage))
      if (trailingIdx >= 0) next.splice(trailingIdx, 0, newRow)
      else next.push(newRow)
      return next
    })
    setHasUnsavedChanges(true)

    toast({
      title: 'Stage Added',
      description: `${stage.stage_name} has been added to the hiring plan`,
    })
  }

  const handleRemoveRowRequest = async (instanceId: string) => {
    const row = planRows.find((r) => r.instanceId === instanceId)
    if (!row) return

    if (row.locked) {
      toast({
        title: 'Cannot Remove Stage',
        description: 'Default stages cannot be removed from the hiring plan',
        variant: 'destructive',
      })
      return
    }

    setRowPendingDelete(row)
    setDeleteDialogOpen(true)
    setPendingDeleteCount(null)
    setCountLoading(true)

    try {
      if (row.jhsId) {
        const { count, error } = await supabase
          .from('job_candidate_associations')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('current_stage_id', row.jhsId)
        setPendingDeleteCount(!error ? (count ?? 0) : 0)
      } else {
        setPendingDeleteCount(0)
      }
    } catch (e) {
      setPendingDeleteCount(0)
    } finally {
      setCountLoading(false)
    }
  }

  const buildSaveInput = (rows: PlanRow[]): HiringPlanInput[] =>
    rows.map((r) => ({ jhsId: r.jhsId, stage_id: r.stage.id, customStageName: r.customStageName ?? null }))

  const handleConfirmRemove = async () => {
    if (!rowPendingDelete) return
    const row = rowPendingDelete
    const newRows = planRows.filter((r) => r.instanceId !== row.instanceId)

    try {
      await saveHiringPlan(jobId, buildSaveInput(newRows))
      // Reload instances to get fresh jhsIds and the correct count of duplicates
      const refreshed = await loadHiringPlanInstances(jobId)
      const seenDefaultStageIds = new Set<string>()
      const rebuilt: PlanRow[] = refreshed.map((inst) => {
        let locked = false
        if (inst.stage.is_default && !seenDefaultStageIds.has(inst.stage.id)) {
          locked = true
          seenDefaultStageIds.add(inst.stage.id)
        }
        return {
          instanceId: inst.jhsId,
          jhsId: inst.jhsId,
          stage: inst.stage as JobStage,
          customStageName: inst.customStageName,
          locked,
        }
      })
      setPlanRows(rebuilt)
      setHasUnsavedChanges(false)

      toast({
        title: 'Stage Removed',
        description: `${row.stage.stage_name} was removed.${(pendingDeleteCount ?? 0) > 0 ? ` ${(pendingDeleteCount ?? 0)} candidate${(pendingDeleteCount ?? 0) !== 1 ? 's' : ''} moved to the previous stage.` : ''}`,
      })
    } finally {
      setDeleteDialogOpen(false)
      setRowPendingDelete(null)
    }
  }

  const handleSaveHiringPlan = async () => {
    if (!jobId) return
    const finalIds = await saveHiringPlan(jobId, buildSaveInput(planRows))
    // Update local jhsIds for newly inserted rows in original order
    setPlanRows((prev) => prev.map((r, idx) => ({ ...r, jhsId: finalIds?.[idx] ?? r.jhsId, instanceId: finalIds?.[idx] ?? r.instanceId })))
    setHasUnsavedChanges(false)
  }

  const handleConfigure = (jhsId: string) => {
    setConfigJhsId(jhsId)
    setConfigSheetOpen(true)
  }

  if (isLoading || !isInitialized) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  // Library stages remain fully available — duplicates are allowed.
  const availableStages = stages

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div>
          <h3 className="text-lg font-medium text-text-primary mb-2">Hiring Plan</h3>
          <p className="text-sm text-text-secondary mb-4">
            Customize the hiring process for this job. Default stages (grayed out) are fixed in priority order. You can add the same stage from the library more than once if you need multiple rounds (e.g. two interview rounds).
          </p>
        </div>
      )}

      <ReadOnlyOverlay active={readOnly} message="Clients can view the hiring plan but cannot edit it.">
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-medium text-text-primary mb-3">Current Hiring Stages</h4>
            {planRows.length === 0 ? (
              <InlineEmpty text="No stages in the hiring plan yet." />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={planRows.filter((r) => !r.locked).map((r) => r.instanceId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {planRows.map((row, index) => (
                      <DraggableStageItem
                        key={row.instanceId}
                        instanceId={row.instanceId}
                        stage={row.stage}
                        index={index}
                        onRemove={handleRemoveRowRequest}
                        onConfigure={handleConfigure}
                        jhsId={row.jhsId}
                        customStageName={row.customStageName}
                        isDragging={activeId === row.instanceId}
                        locked={row.locked}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                  {activeId && (() => {
                    const row = planRows.find((r) => r.instanceId === activeId)
                    if (!row) return null
                    const index = planRows.indexOf(row)
                    return (
                      <div style={{ transform: 'rotate(-1.5deg) scale(1.03)', boxShadow: '0 12px 24px rgba(0,0,0,0.15)' }}>
                        <DraggableStageItem
                          instanceId={row.instanceId}
                          stage={row.stage}
                          index={index}
                          onRemove={() => {}}
                          jhsId={row.jhsId}
                          customStageName={row.customStageName}
                          locked={row.locked}
                        />
                      </div>
                    )
                  })()}
                </DragOverlay>
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
                      options={availableStages.map((stage) => ({
                        value: stage.id,
                        label: stage.stage_name,
                        description: stage.stage_description,
                      }))}
                      placeholder="Select a stage to add..."
                      searchPlaceholder="Search stages..."
                    />
                  </div>
                  <Plus className="h-4 w-4 text-text-secondary" />
                </div>
                <p className="text-xs text-text-secondary mt-2">
                  Add a stage as many times as you need — same stage can appear multiple times.
                </p>
              </div>
            </>
          )}
        </div>
      </ReadOnlyOverlay>

      <div className="pt-4 border-t border-border/50">
        <div className="flex justify-between items-center">
          <p className="text-sm text-text-secondary">Total stages: {planRows.length}</p>
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
              {rowPendingDelete && (
                <div>
                  Are you sure you want to remove "{rowPendingDelete.stage.stage_name}" from this hiring plan?
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
            <AlertDialogAction onClick={handleConfirmRemove}>Remove stage</AlertDialogAction>
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
