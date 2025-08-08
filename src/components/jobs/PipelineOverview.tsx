
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useJobHiringPlan, JobStage } from '@/hooks/useJobHiringPlan'
import CandidateCard from './CandidateCard'
import { usePipelineActions, PipelineAssociation } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'
import { DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import DraggableCandidateCard from './DraggableCandidateCard'
import DroppableStage from './DroppableStage'
import CandidateProfileSheet from '@/components/candidates/CandidateProfileSheet'

interface PipelineOverviewProps {
  jobId: string
  showHeader?: boolean
  externalScroll?: boolean
}

const stageTypeVariants: Record<string, import('@/components/ui/badge').BadgeProps['variant']> = {
  application: 'pastel-blue',
  screening: 'info',
  interview: 'pastel-purple',
  assessment: 'warning',
  reference_check: 'pastel-orange',
  offer: 'success',
  onboarding: 'pastel-green',
  custom: 'secondary',
}

const isLastPriorityStage = (stage: JobStage) => {
  const p = stage.stage_priority as any
  return p === 'last' || p === 99 || p === '99' || p === 999 || p === '999'
}

export function PipelineOverview({ jobId, showHeader = true, externalScroll = false }: PipelineOverviewProps) {
  const { loadHiringPlanInstances, isLoadingPlan } = useJobHiringPlan()
  const { fetchAssociationsForJob, moveAssociationToStage } = usePipelineActions()

  const [stageOptions, setStageOptions] = useState<{ jhsId: string; stage: JobStage; position: number }[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [byStage, setByStage] = useState<Record<string, PipelineAssociation[]>>({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 10 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  const sensors = useSensors(mouseSensor, touchSensor)

  const getTimeInfo = useCallback((a: PipelineAssociation) => {
    const base = a.entered_stage_at || a.created_at
    const nowMs = Date.now()
    const startedMs = base ? new Date(base).getTime() : nowMs
    let diffSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000))

    if (diffSec < 60) {
      return { label: `${diffSec}s`, variant: 'success' as const }
    }
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) {
      return { label: `${diffMin}m`, variant: 'success' as const }
    }
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) {
      return { label: `${diffH}h`, variant: 'success' as const }
    }
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) {
      return { label: `${diffD}d`, variant: 'warning' as const }
    }
    // Weeks and months -> red
    if (diffD >= 28) {
      const months = Math.max(1, Math.floor(diffD / 30))
      return { label: `${months}mo`, variant: 'destructive' as const }
    }
    const diffW = Math.floor(diffD / 7)
    return { label: `${diffW}w`, variant: 'destructive' as const }
  }, [])

  const getHeaderBgClass = (type: string) => {
    switch (type) {
      case 'application':
        return 'bg-pastel-blue/20'
      case 'screening':
        return 'bg-info/20'
      case 'interview':
        return 'bg-pastel-purple/20'
      case 'assessment':
        return 'bg-warning/20'
      case 'reference_check':
        return 'bg-pastel-orange/20'
      case 'offer':
        return 'bg-success/20'
      case 'onboarding':
        return 'bg-pastel-green/20'
      default:
        return 'bg-secondary/20'
    }
  }

  const loadStages = useCallback(async () => {
    const plan = await loadHiringPlanInstances(jobId)
    if (plan.length > 0) {
      // Ensure any "last" priority defaults appear at the end
      const defaults = plan.filter(p => p.stage.is_default)
      const customs = plan.filter(p => !p.stage.is_default)
      const normalDefaults = defaults.filter(p => !isLastPriorityStage(p.stage))
      const lastDefaults = defaults.filter(p => isLastPriorityStage(p.stage))
      setStageOptions([...normalDefaults, ...customs, ...lastDefaults])
    } else {
      setStageOptions([])
    }
  }, [jobId, loadHiringPlanInstances])

  const loadPipeline = useCallback(async () => {
    if (!jobId) return
    setIsLoadingCandidates(true)
    try {
      const associations = await fetchAssociationsForJob(jobId)
      const grouped: Record<string, PipelineAssociation[]> = {}
      associations.forEach(a => {
        if (!a.current_stage_id) return
        if (!grouped[a.current_stage_id]) grouped[a.current_stage_id] = []
        grouped[a.current_stage_id].push(a)
      })
      setByStage(grouped)
    } catch (e) {
      console.error('Failed to load pipeline:', e)
      toast({
        title: 'Error',
        description: 'Failed to load candidates in pipeline.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingCandidates(false)
    }
  }, [jobId, fetchAssociationsForJob])

  useEffect(() => {
    if (!jobId) return
    ;(async () => {
      await loadStages()
    })()
  }, [jobId, loadStages])

  useEffect(() => {
    if (!jobId) return
    ;(async () => {
      await loadPipeline()
    })()
  }, [jobId, stageOptions, loadPipeline])

  const handleMove = async (associationId: string, toStageId: string) => {
    await moveAssociationToStage(associationId, toStageId)
    await loadPipeline()
  }

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const assocId = String(active.id)
    const toStageId = String(over.id)
    await moveAssociationToStage(assocId, toStageId)
    await loadPipeline()
  }, [moveAssociationToStage, loadPipeline])

  // Ordered list of candidate IDs across the pipeline (by stage order, then pipeline_position, then created_at)
  const orderedCandidateIds = useMemo(() => {
    const perStage = stageOptions.map(opt => {
      const arr = (byStage[opt.jhsId] || []).slice().sort((a, b) => {
        const pa = a.pipeline_position ?? Number.MAX_SAFE_INTEGER
        const pb = b.pipeline_position ?? Number.MAX_SAFE_INTEGER
        if (pa !== pb) return pa - pb
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      return arr
    })
    return perStage.flat().map(a => a.candidate_id)
  }, [byStage, stageOptions])

  const currentIndex = selectedCandidateId ? orderedCandidateIds.indexOf(selectedCandidateId) : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < orderedCandidateIds.length - 1

  const handlePrevCandidate = useCallback(() => {
    if (hasPrev) {
      setSelectedCandidateId(orderedCandidateIds[currentIndex - 1])
    }
  }, [hasPrev, currentIndex, orderedCandidateIds])

  const handleNextCandidate = useCallback(() => {
    if (hasNext) {
      setSelectedCandidateId(orderedCandidateIds[currentIndex + 1])
    }
  }, [hasNext, currentIndex, orderedCandidateIds])

  return (
    <div className="space-y-4">
      {showHeader && (
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Pipeline Overview</h1>
          <p className="text-sm text-text-secondary">Columns reflect the job's hiring plan stages.</p>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className={`flex gap-4 ${externalScroll ? '' : 'overflow-x-auto'} pb-2`}>
          {isLoadingPlan && (
            <div className="text-sm text-text-secondary">Loading pipeline...</div>
          )}

          {!isLoadingPlan && stageOptions.length === 0 && (
            <Card className="min-w-[280px]">
              <CardContent className="py-8 text-center text-text-secondary text-sm">
                No hiring plan defined yet.
              </CardContent>
            </Card>
          )}

          {/* Render columns with candidate cards */}
          {!isLoadingPlan && stageOptions.map((opt) => (
            <Card key={opt.jhsId} className="w-72 flex-shrink-0 h-full flex flex-col">
              <CardHeader className={`pb-3 rounded-t-md shrink-0 ${getHeaderBgClass(opt.stage.stage_type)}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-medium truncate max-w-[180px]" title={opt.stage.stage_name}>
                    {opt.stage.stage_name}
                  </CardTitle>
                  {opt.stage.is_default && (
                    <Badge variant="outline">Default</Badge>
                  )}
                  {isLastPriorityStage(opt.stage) && (
                    <Badge variant="outline">Last</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className={`${getHeaderBgClass(opt.stage.stage_type)} rounded-b-md flex-1 overflow-y-auto`}>  
                <DroppableStage id={opt.jhsId} isEmpty={!byStage[opt.jhsId] || byStage[opt.jhsId].length === 0} tintClass={getHeaderBgClass(opt.stage.stage_type)}>
                  {isLoadingCandidates && (
                    <div className="text-xs text-text-tertiary">Loading candidates...</div>
                  )}

                  {!isLoadingCandidates && (!byStage[opt.jhsId] || byStage[opt.jhsId].length === 0) && (
                    <div className="text-xs text-text-tertiary">
                      No candidates in this stage
                    </div>
                  )}

                  <div className="space-y-2">
                    {(byStage[opt.jhsId] || []).map(assoc => {
                      const t = getTimeInfo(assoc)
                      return (
                        <DraggableCandidateCard id={assoc.id} key={assoc.id}>
                          <CandidateCard
                            candidateName={assoc.candidate_name}
                            linkedinUrl={assoc.linkedin_url}
                            stageOptions={stageOptions}
                            currentStageJhsId={opt.jhsId}
                            timeInStageLabel={t.label}
                            timeBadgeVariant={t.variant}
                            onMove={(toId) => handleMove(assoc.id, toId)}
                            onClick={() => { setSelectedCandidateId(orderedCandidateIds.find(id => id === assoc.candidate_id) || assoc.candidate_id); setPanelOpen(true) }}
                          />
                        </DraggableCandidateCard>
                      )
                    })}
                  </div>
                </DroppableStage>
              </CardContent>
            </Card>
          ))}
        </div>
      </DndContext>
      <CandidateProfileSheet open={panelOpen} onOpenChange={(o) => setPanelOpen(o)} candidateId={selectedCandidateId} jobId={jobId} hasPrev={hasPrev} hasNext={hasNext} onNavigatePrev={handlePrevCandidate} onNavigateNext={handleNextCandidate} />
    </div>
  )
}

