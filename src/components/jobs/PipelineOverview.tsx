import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useJobHiringPlan, JobStage } from '@/hooks/useJobHiringPlan'

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
  const [stages, setStages] = useState<JobStage[]>([])

  useEffect(() => {
    if (!jobId) return
    ;(async () => {
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
    })()
  }, [jobId, loadHiringPlan])

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
              <div className="text-xs text-text-tertiary">
                No items yet
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
