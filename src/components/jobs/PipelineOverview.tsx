
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useJobHiringPlan, JobStage } from '@/hooks/useJobHiringPlan'
import CandidateCard from './CandidateCard'
import { usePipelineActions, PipelineAssociation } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'

interface PipelineOverviewProps {
  jobId: string
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

export function PipelineOverview({ jobId }: PipelineOverviewProps) {
  const { loadHiringPlan, isLoadingPlan } = useJobHiringPlan()
  const { fetchAssociationsForJob, moveAssociationToStage } = usePipelineActions()

  const [stages, setStages] = useState<JobStage[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [byStage, setByStage] = useState<Record<string, PipelineAssociation[]>>({})

  const getTimeInStageLabel = useCallback((a: PipelineAssociation) => {
    const base = a.entered_stage_at || a.created_at
    if (!base) return undefined
    const started = new Date(base).getTime()
    const now = Date.now()
    const diffMin = Math.max(0, Math.floor((now - started) / 60000))
    if (diffMin < 60) return `${diffMin}m`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}d`
    const diffW = Math.floor(diffD / 7)
    return `${diffW}w`
  }, [])

  const loadStages = useCallback(async () => {
    const plan = await loadHiringPlan(jobId)
    if (plan.length > 0) {
      // Ensure any "last" priority stages appear at the end
      const defaults = plan.filter(s => s.is_default)
      const customs = plan.filter(s => !s.is_default)
      const normalDefaults = defaults.filter(s => !isLastPriorityStage(s))
      const lastDefaults = defaults.filter(s => isLastPriorityStage(s))
      setStages([...normalDefaults, ...customs, ...lastDefaults])
    } else {
      setStages([])
    }
  }, [jobId, loadHiringPlan])

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
  }, [jobId, stages, loadPipeline])

  const handleMove = async (associationId: string, toStageId: string) => {
    await moveAssociationToStage(associationId, toStageId)
    await loadPipeline()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Pipeline Overview</h1>
        <p className="text-sm text-text-secondary">Columns reflect the job's hiring plan stages.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {isLoadingPlan && (
          <div className="text-sm text-text-secondary">Loading pipeline...</div>
        )}

        {!isLoadingPlan && stages.length === 0 && (
          <Card className="min-w-[280px]">
            <CardContent className="py-8 text-center text-text-secondary text-sm">
              No hiring plan defined yet.
            </CardContent>
          </Card>
        )}

        {/* Render columns with candidate cards */}
        {!isLoadingPlan && stages.map((stage) => (
          <Card key={stage.id} className="w-72 flex-shrink-0">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-medium truncate max-w-[180px]" title={stage.stage_name}>
                  {stage.stage_name}
                </CardTitle>
                <Badge variant={stageTypeVariants[stage.stage_type] ?? 'secondary'}>
                  {stage.stage_type.replace('_', ' ')}
                </Badge>
                {stage.is_default && (
                  <Badge variant="outline">Default</Badge>
                )}
                {isLastPriorityStage(stage) && (
                  <Badge variant="outline">Last</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCandidates && (
                <div className="text-xs text-text-tertiary">Loading candidates...</div>
              )}

              {!isLoadingCandidates && (!byStage[stage.id] || byStage[stage.id].length === 0) && (
                <div className="text-xs text-text-tertiary">
                  No candidates in this stage
                </div>
              )}

              <div className="space-y-2">
                {(byStage[stage.id] || []).map(assoc => (
                  <CandidateCard
                    key={assoc.id}
                    candidateName={assoc.candidate_name}
                    linkedinUrl={assoc.linkedin_url}
                    stages={stages}
                    currentStageId={stage.id}
                    timeInStageLabel={getTimeInStageLabel(assoc)}
                    onMove={(toId) => handleMove(assoc.id, toId)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

