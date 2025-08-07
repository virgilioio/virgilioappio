import { useState, useEffect } from 'react'
import { useJobStages } from '@/hooks/useJobStages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Trash2, Plus } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface JobStage {
  id: string
  stage_name: string
  stage_type: string
  stage_description?: string
  is_default: boolean
  stage_priority?: number
}

interface HiringPlanTabProps {
  jobId: string
}

export function HiringPlanTab({ jobId }: HiringPlanTabProps) {
  const { stages, isLoading } = useJobStages()
  const [selectedStages, setSelectedStages] = useState<JobStage[]>([])
  const [availableStages, setAvailableStages] = useState<JobStage[]>([])

  // Initialize with default stages
  useEffect(() => {
    if (stages.length > 0) {
      const defaultStages = stages.filter(stage => stage.is_default)
      setSelectedStages(defaultStages)
      setAvailableStages(stages.filter(stage => !stage.is_default))
    }
  }, [stages])

  const handleAddStage = (stageId: string) => {
    const stage = availableStages.find(s => s.id === stageId)
    if (!stage) return

    setSelectedStages(prev => [...prev, stage])
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
    setAvailableStages(prev => [...prev, stage].sort((a, b) => 
      (a.stage_priority || 999) - (b.stage_priority || 999)
    ))
    
    toast({
      title: 'Stage Removed',
      description: `${stage.stage_name} has been removed from the hiring plan`
    })
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

  if (isLoading) {
    return <div>Loading stages...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-2">Hiring Plan</h3>
        <p className="text-sm text-text-secondary mb-4">
          Customize the hiring process for this job by adding or removing stages. Default stages cannot be removed.
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
            <div className="space-y-3">
              {selectedStages
                .sort((a, b) => (a.stage_priority || 999) - (b.stage_priority || 999))
                .map((stage, index) => (
                <Card key={stage.id} className="transition-colors hover:bg-surface-secondary/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-text-primary">{stage.stage_name}</h5>
                            <Badge variant={getStageTypeVariant(stage.stage_type)}>
                              {stage.stage_type.replace('_', ' ')}
                            </Badge>
                            {stage.is_default && (
                              <Badge variant="secondary">Default</Badge>
                            )}
                          </div>
                          {stage.stage_description && (
                            <p className="text-sm text-text-secondary">{stage.stage_description}</p>
                          )}
                        </div>
                      </div>
                      {!stage.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStage(stage.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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