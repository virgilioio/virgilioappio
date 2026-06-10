/**
 * InlineKanban — expansion panel under JobPipelineRow.
 * Reads per-job hiring stages (jhsId map) + associations, renders an
 * equal-width column grid with DnD between stages.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { ArrowUpRight, Plus, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { InlineCandidateRow, type InlineCandidate } from './InlineCandidateRow'

interface KanbanStage {
  jhsId: string
  name: string
  color: string
  candidates: InlineCandidate[]
}

const RAMP = ['#ADB2BD', '#C9B8FB', '#A98BFA', '#8456F6', '#6F3FF5']
function dotColor(i: number, total: number) {
  if (total <= 1) return RAMP[RAMP.length - 1]
  if (i === 0) return RAMP[0]
  if (i === total - 1) return RAMP[RAMP.length - 1]
  const idx = Math.round((i / (total - 1)) * (RAMP.length - 1))
  return RAMP[idx]
}

function daysSince(iso: string | null): number {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

export function InlineKanban({ jobId }: { jobId: string }) {
  const navigate = useNavigate()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const { fetchAssociationsForJob, moveAssociationToStage } = usePipelineActions()

  const [stages, setStages] = useState<KanbanStage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [plan, assocs] = await Promise.all([
        loadHiringPlanInstances(jobId),
        fetchAssociationsForJob(jobId),
      ])
      const byJhs = new Map<string, InlineCandidate[]>()
      assocs
        .filter((a) => a.status === 'active' && a.current_stage_id)
        .forEach((a) => {
          const list = byJhs.get(a.current_stage_id!) ?? []
          list.push({
            id: a.id,
            candidateId: a.candidate_id,
            name: a.candidate_name,
            daysInStage: daysSince(a.entered_stage_at || a.created_at),
          })
          byJhs.set(a.current_stage_id!, list)
        })
      const next: KanbanStage[] = plan.map((p, i) => ({
        jhsId: p.jhsId,
        name: p.customStageName || p.stage.stage_name,
        color: dotColor(i, plan.length),
        candidates: byJhs.get(p.jhsId) ?? [],
      }))
      setStages(next)
    } finally {
      setLoading(false)
    }
  }, [jobId, loadHiringPlanInstances, fetchAssociationsForJob])

  useEffect(() => {
    refresh()
  }, [refresh])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const activeCandidate = useMemo(() => {
    if (!activeId) return null
    for (const s of stages) {
      const c = s.candidates.find((x) => x.id === activeId)
      if (c) return c
    }
    return null
  }, [activeId, stages])

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    setOverStage(null)
    const associationId = String(e.active.id)
    const toJhs = e.over?.id ? String(e.over.id) : null
    if (!toJhs) return
    let fromJhs: string | null = null
    let candidate: InlineCandidate | null = null
    for (const s of stages) {
      const c = s.candidates.find((x) => x.id === associationId)
      if (c) {
        fromJhs = s.jhsId
        candidate = c
        break
      }
    }
    if (!candidate || fromJhs === toJhs) return
    // Optimistic: move + reset days
    setStages((prev) =>
      prev.map((s) => {
        if (s.jhsId === fromJhs) return { ...s, candidates: s.candidates.filter((x) => x.id !== associationId) }
        if (s.jhsId === toJhs) return { ...s, candidates: [...s.candidates, { ...candidate!, daysInStage: 0 }] }
        return s
      }),
    )
    try {
      await moveAssociationToStage(associationId, toJhs, { silent: true })
    } catch (err) {
      console.error(err)
      toast({ title: 'Move failed', description: 'Could not move candidate.', variant: 'destructive' })
      refresh()
    }
  }

  const totalActive = stages.reduce((s, x) => s + x.candidates.length, 0)

  return (
    <div
      className="border-t"
      style={{ background: '#FAFAF7', borderColor: '#F1F0EC', padding: 12 }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="font-inter" style={{ fontSize: 11.5, color: '#5A6072' }}>
          <span className="font-medium text-[#1F2230]">{totalActive}</span> active candidates ·{' '}
          <span className="font-medium text-[#1F2230]">{stages.length}</span> stages
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-inter text-[11.5px] text-[#5A6072] hover:bg-[#F1F0EC]"
          >
            <UserPlus size={12} strokeWidth={2} /> Add candidate
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/jobs/${jobId}`)
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 font-inter text-[11.5px] text-[#1F2230] hover:bg-[#FAFAF7]"
            style={{ borderColor: '#E7E8EE' }}
          >
            Open board <ArrowUpRight size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}
        onDragOver={(e) => setOverStage(e.over?.id ? String(e.over.id) : null)}>
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))`, gap: 8 }}
        >
          {loading && stages.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[10px] bg-white"
                  style={{ border: '1px solid #E7E8EE', height: 110 }}
                />
              ))
            : stages.map((s) => (
                <KanbanColumn
                  key={s.jhsId}
                  stage={s}
                  isOver={overStage === s.jhsId}
                  isDragging={!!activeId}
                  onCandidateClick={(candId) => navigate(`/candidates/${candId}`)}
                />
              ))}
        </div>
        <DragOverlay>
          {activeCandidate ? (
            <div className="opacity-90">
              <InlineCandidateRow c={activeCandidate} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function KanbanColumn({
  stage,
  isOver,
  isDragging,
  onCandidateClick,
}: {
  stage: KanbanStage
  isOver: boolean
  isDragging: boolean
  onCandidateClick: (candidateId: string) => void
}) {
  const { setNodeRef } = useDroppable({ id: stage.jhsId })
  return (
    <div
      className="rounded-[10px] bg-white"
      style={{
        border: `1px solid ${isOver ? '#D7C5FB' : '#E7E8EE'}`,
        background: isOver ? 'rgba(237,228,255,0.4)' : '#FFFFFF',
      }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span
          className="inline-block shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: stage.color }}
        />
        <span
          className="min-w-0 flex-1 truncate font-poppins"
          style={{ fontSize: 11, fontWeight: 600, color: '#0d0d09', letterSpacing: '-0.01em' }}
          title={stage.name}
        >
          {stage.name}
        </span>
        <span
          className="font-poppins tabular-nums"
          style={{ fontSize: 11, fontWeight: 500, color: '#8B8F9E' }}
        >
          {stage.candidates.length}
        </span>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-[#8B8F9E] hover:bg-[#F1F0EC]"
          aria-label="Add candidate to stage"
        >
          <Plus size={11} strokeWidth={2} />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className="flex flex-col gap-1.5 px-2 pb-2"
        style={{ background: '#FCFCFA', minHeight: 76, paddingTop: 6 }}
      >
        {stage.candidates.length === 0 ? (
          <div
            className={cn(
              'flex h-[68px] items-center justify-center rounded-[7px] font-inter',
            )}
            style={{
              border: `1px dashed ${isOver ? '#D7C5FB' : '#E7E8EE'}`,
              fontSize: 10.5,
              color: '#B5B9C4',
            }}
          >
            {isDragging ? 'Drop here' : 'Empty'}
          </div>
        ) : (
          stage.candidates.map((c) => (
            <InlineCandidateRow key={c.id} c={c} onClick={onCandidateClick} />
          ))
        )}
      </div>
    </div>
  )
}
