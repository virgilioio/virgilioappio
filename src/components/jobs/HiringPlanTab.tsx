import { useState, useEffect } from 'react'
import { InlineEmpty } from '@/components/ui/empty-state'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useJobStages } from '@/hooks/useJobStages'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { DraggableStageItem } from './DraggableStageItem'
import { useJobHiringPlan, type HiringPlanInput } from '@/hooks/useJobHiringPlan'
import { supabase } from '@/lib/supabaseClient'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
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

  // Configuration sheet state
  const [configSheetOpen, setConfigSheetOpen] = useState(false)
  const [configJhsId, setConfigJhsId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // A default stage with priority 99 or more (or none) belongs at the end;
  // the rest go first. job_plan_ranked in the database uses the same line.
  const isLastPriorityStage = (stage: JobStage) => {
    const p = stage.stage_priority
    return p == null || p === '' || p === 'last' || Number(p) >= 99
  }
  const priorityOf = (row: PlanRow) => {
    const p = Number(row.stage.stage_priority)
    return Number.isFinite(p) ? p : 500
  }

  // Default stages sit first in priority order (Application Review, then Final
  // Candidate Review), a "last" one at the end, and every other stage between
  // them in the team's order (Allan, 2026-10-29). Saving goes through
  // job_plan_order, which keeps the same rule.
  const arrangeRows = (rows: PlanRow[]): PlanRow[] => {
    const head = rows.filter((r) => r.locked && !isLastPriorityStage(r.stage))
    const tail = rows.filter((r) => r.locked && isLastPriorityStage(r.stage))
    const rest = rows.filter((r) => !r.locked)
    const byPriority = (list: PlanRow[]) =>
      list.map((r, i) => ({ r, i })).sort((a, b) => priorityOf(a.r) - priorityOf(b.r) || a.i - b.i).map((x) => x.r)
    return [...byPriority(head), ...rest, ...byPriority(tail)]
  }

  // The first row of each default stage is locked: it can't be removed or moved.
  const rowsFromInstances = (instances: Awaited<ReturnType<typeof loadHiringPlanInstances>>): PlanRow[] => {
    const seenDefaultStageIds = new Set<string>()
    return arrangeRows(instances.map((inst) => {
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
    }))
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
          rows = rowsFromInstances(instances)
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
      // Only the team's stages move, among themselves; the defaults stay put.
      const movable = rows.filter((r) => !r.locked)
      const oldIndex = movable.findIndex((r) => r.instanceId === active.id)
      const newIndex = movable.findIndex((r) => r.instanceId === over.id)
      if (oldIndex === -1 || newIndex === -1) return rows
      const moved = arrayMove(movable, oldIndex, newIndex)
      return arrangeRows([...rows.filter((r) => r.locked), ...moved])
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
      // After the team's stages, before a "last" default.
      return arrangeRows([...next, newRow])
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

    const name = row.customStageName?.trim() || row.stage.stage_name
    // A row that was never saved has nothing behind it yet.
    if (!row.jhsId) {
      setPlanRows((prev) => prev.filter((r) => r.instanceId !== instanceId))
      return
    }

    // J16 (Block B §16): what the stage holds decides the dialog. Candidates in
    // it move back a stage (type to confirm); its interviewers, scorecard
    // questions, automations and submitted scorecards are deleted with it;
    // booked interviews block it, because the database keeps that history.
    const count = (q: any) => q.then((r: { count: number | null; error: unknown }) => (r.error ? 0 : r.count ?? 0)) as Promise<number>
    let candidates = 0, scorecards = 0, bookings = 0
    try {
      ;[candidates, scorecards, bookings] = await Promise.all([
        count(supabase.from('job_candidate_associations').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('current_stage_id', row.jhsId)),
        count(supabase.from('job_stage_scorecards').select('id', { count: 'exact', head: true }).eq('stage_instance_id', row.jhsId)),
        count(supabase.from('scheduled_bookings').select('id', { count: 'exact', head: true }).eq('job_hiring_stage_id', row.jhsId)),
      ])
    } catch {
      /* counted as 0; the database still refuses what it must */
    }
    const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

    if (bookings > 0) {
      await confirmDestructive({
        variant: 'blocked',
        title: `The ${name} stage can’t be deleted`,
        description: `${plural(bookings, 'interview')} ${bookings === 1 ? 'was' : 'were'} booked in this stage, and that history has to stay. It stays in the plan; you can still rename it or change its settings from Edit.`,
        confirmLabel: '',
      })
      return
    }

    const idx = planRows.findIndex((r) => r.instanceId === instanceId)
    const rest = planRows.filter((r) => r.instanceId !== instanceId)
    // Candidates and scorecards never leave the pipeline (Allan, 2026-10-13):
    // they move to the stage before, or to the stage after when this one is
    // first. A plan's only stage can't go while it holds either.
    if (!rest.length && (candidates > 0 || scorecards > 0)) {
      const holds = [
        candidates > 0 ? plural(candidates, 'candidate') : '',
        scorecards > 0 ? plural(scorecards, 'scorecard') : '',
      ].filter(Boolean).join(' and ')
      await confirmDestructive({
        variant: 'blocked',
        title: `The ${name} stage can’t be deleted yet`,
        description: `It’s the only stage in this plan and it holds ${holds}. Add another stage first, so they have somewhere to go.`,
        confirmLabel: '',
      })
      return
    }
    const targetIndex = idx > 0 ? idx - 1 : 0
    const target = rest[targetIndex]
    const targetName = target ? target.customStageName?.trim() || target.stage.stage_name : 'the first stage'
    const wasFirst = idx === 0
    const moves = candidates > 0
      ? `${plural(candidates, 'candidate')} in it move${candidates === 1 ? 's' : ''} ${wasFirst ? `to ${targetName} (the new first stage)` : `back to ${targetName}`} and stay${candidates === 1 ? 's' : ''} in the pipeline. `
      : ''
    const cards = scorecards > 0
      ? `${scorecards === 1 ? 'Its scorecard moves' : `Its ${scorecards} scorecards move`} to ${targetName} with ${scorecards === 1 ? 'its answers' : 'their answers'}, marked as from ${name}. `
      : ''
    const goes = `${cards}Its interviewers, unanswered scorecard questions and automations are deleted with it.`
    const unsaved = hasUnsavedChanges ? ' Your other unsaved changes to the plan are saved too.' : ''

    const remove = async () => {
      await handleConfirmRemove(row, name, candidates, targetName, targetIndex, wasFirst)
    }
    const ok = await confirmDestructive({
      title: `Delete the ${name} stage?`,
      description: `${moves}${goes}${unsaved} This can’t be undone.`,
      confirmLabel: 'Delete stage',
      typeToConfirm: candidates > 0 ? name : undefined,
      onConfirm: candidates > 0
        ? async () => {
            try {
              await remove()
            } catch {
              throw new Error(`Couldn’t delete ${name}. Nothing was removed; try again.`)
            }
          }
        : undefined,
    })
    if (ok && candidates === 0) {
      try {
        await remove()
      } catch {
        /* the hook shows the error */
      }
    }
  }

  const buildSaveInput = (rows: PlanRow[]): HiringPlanInput[] =>
    rows.map((r) => ({ jhsId: r.jhsId, stage_id: r.stage.id, customStageName: r.customStageName ?? null }))

  const handleConfirmRemove = async (
    row: PlanRow, name: string, moved: number, targetName: string, targetIndex: number, wasFirst: boolean,
  ) => {
    const newRows = planRows.filter((r) => r.instanceId !== row.instanceId)
    await saveHiringPlan(jobId, buildSaveInput(newRows), row.jhsId ? { moveTo: { [row.jhsId]: targetIndex } } : {})
    // Reload instances to get fresh jhsIds and the correct count of duplicates
    const refreshed = await loadHiringPlanInstances(jobId)
    setPlanRows(rowsFromInstances(refreshed))
    setHasUnsavedChanges(false)

    toast({
      title: `${name} deleted`,
      description: moved > 0 ? `${moved} candidate${moved !== 1 ? 's' : ''} moved ${wasFirst ? 'to' : 'back to'} ${targetName}.` : undefined,
    })
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

  const addStageButton = availableStages.length > 0 ? (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={readOnly}
          className="inline-flex items-center gap-1.5 font-poppins font-medium transition-colors disabled:opacity-50"
          style={{
            height: 32,
            padding: '0 12px',
            background: '#ffffff',
            border: '1px solid #E0DDD3',
            borderRadius: 8,
            color: '#1F2230',
            fontSize: 12.5,
            cursor: readOnly ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => !readOnly && (e.currentTarget.style.background = '#FAFAF7')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
        >
          <Plus style={{ width: 14, height: 14 }} />
          Add stage
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-2">
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
      </PopoverContent>
    </Popover>
  ) : null

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
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-poppins" style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230', letterSpacing: '-0.005em' }}>
              Stages
            </h3>
            {addStageButton}
          </div>

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {planRows.map((row, index) => (
                    <DraggableStageItem
                      key={row.instanceId}
                      instanceId={row.instanceId}
                      stage={row.stage}
                      index={index}
                      onRemove={handleRemoveRowRequest}
                      onConfigure={handleConfigure}
                      onDuplicate={handleAddStage}
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
        </section>
      </ReadOnlyOverlay>

      <div className="pt-4 border-t border-border/50">
        <div className="flex justify-between items-center">
          <p className="text-sm text-text-secondary">Total stages: {planRows.length}</p>
          <Button loading={isSavingPlan}
            disabled={readOnly || !hasUnsavedChanges || isSavingPlan}
            onClick={handleSaveHiringPlan}
          >
            Save Hiring Plan
          </Button>
        </div>
      </div>




      <StageConfigSheet
        open={configSheetOpen}
        onOpenChange={setConfigSheetOpen}
        jhsId={configJhsId}
        jobId={jobId}
      />
    </div>
  )
}
