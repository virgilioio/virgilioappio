import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Info, Loader2 } from 'lucide-react'
import type { StageConfiguration } from '@/hooks/useStageConfiguration'

interface BasicsTabProps {
  config: StageConfiguration
  onSave: (customName: string | null) => Promise<void>
  isSaving: boolean
}

export function BasicsTab({ config, onSave, isSaving }: BasicsTabProps) {
  const [customName, setCustomName] = useState(config.customStageName || '')
  const [hasChanges, setHasChanges] = useState(false)
  
  useEffect(() => {
    const changed = customName.trim() !== (config.customStageName || '')
    setHasChanges(changed)
  }, [customName, config.customStageName])
  
  const handleSave = async () => {
    await onSave(customName.trim() || null)
    setHasChanges(false)
  }
  
  const handleReset = () => {
    setCustomName('')
    setHasChanges(true)
  }
  
  const stageTypeVariants: Record<string, any> = {
    application: 'pastel-blue',
    screening: 'info',
    interview: 'pastel-purple',
    assessment: 'warning',
    reference_check: 'pastel-orange',
    offer: 'success',
    onboarding: 'pastel-green',
    custom: 'secondary',
  }
  
  return (
    <div className="space-y-6">
      {/* Stage Information Card */}
      <section aria-labelledby="stage-info">
        <h3 id="stage-info" className="text-sm font-medium text-text-primary mb-3">
          Stage Information
        </h3>
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Default Name</Label>
              <p className="text-sm font-medium">{config.stageName}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Badge variant={stageTypeVariants[config.stageType] ?? 'secondary'} className="text-xs">
                {config.stageType.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          {config.stageDescription && (
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm">{config.stageDescription}</p>
            </div>
          )}
        </div>
      </section>
      
      {/* Custom Name Override */}
      <section aria-labelledby="custom-name">
        <h3 id="custom-name" className="text-sm font-medium text-text-primary mb-3">
          Custom Stage Name
        </h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="custom-stage-name">
              Stage Name for This Job
            </Label>
            <Input
              id="custom-stage-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={config.stageName}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use default name "{config.stageName}"
            </p>
          </div>
          
          {customName && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Preview:</strong> Candidates will see "{customName || config.stageName}" 
                in the pipeline for this job
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!customName || isSaving}
            >
              Reset to Default
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </section>
      
      {/* Future Config Placeholder */}
      <section aria-labelledby="future-config">
        <h3 id="future-config" className="text-sm font-medium text-text-primary mb-3">
          Additional Settings
        </h3>
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            More configuration options coming soon
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Stage instructions, duration estimates, and more
          </p>
        </div>
      </section>
    </div>
  )
}
