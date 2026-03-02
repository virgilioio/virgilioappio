import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings, Users, Zap, ClipboardList, Loader2 } from 'lucide-react'
import { useStageConfiguration, type StageConfiguration } from '@/hooks/useStageConfiguration'
import { BasicsTab } from './stage-config/BasicsTab'
import { TeamTab } from './stage-config/TeamTab'
import { AutomationsTab } from './stage-config/AutomationsTab'
import { ScorecardsTab } from './stage-config/ScorecardsTab'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

interface StageConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jhsId: string | null // job_hiring_stages.id
  jobId: string
}

export function StageConfigSheet({ open, onOpenChange, jhsId, jobId }: StageConfigSheetProps) {
  const { loadStageConfig, updateCustomStageName, isLoading } = useStageConfiguration()
  const [config, setConfig] = useState<StageConfiguration | null>(null)
  
  // Fetch job data for organization_id
  const { data: job } = useQuery({
    queryKey: ['job-org-context', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('organization_id')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data
    },
    enabled: open && !!jobId
  })
  
  useEffect(() => {
    if (open && jhsId) {
      loadStageConfig(jhsId)
        .then(setConfig)
        .catch(console.error)
    }
  }, [open, jhsId])
  
  const handleSaveBasics = async (customName: string | null) => {
    if (!jhsId) return
    await updateCustomStageName.mutateAsync({ jhsId, customName })
    // Reload config to reflect changes
    const updatedConfig = await loadStageConfig(jhsId)
    setConfig(updatedConfig)
  }
  
  if (isLoading || !config) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
            Configure Stage: {config.customStageName || config.stageName}<span className="text-purple-period">.</span>
          </SheetTitle>
          <SheetDescription className="text-virgilio-muted">
            Customize this stage's behavior for this specific job
          </SheetDescription>
        </SheetHeader>
        
        <Tabs defaultValue="basics" className="mt-6">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="basics">
              <Settings className="h-4 w-4 mr-2" />
              Basics
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="h-4 w-4 mr-2" />
              Team
            </TabsTrigger>
            <TabsTrigger value="automations">
              <Zap className="h-4 w-4 mr-2" />
              Automations
            </TabsTrigger>
            <TabsTrigger value="scorecards">
              <ClipboardList className="h-4 w-4 mr-2" />
              Scorecards
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="basics" className="mt-6">
            <BasicsTab
              config={config}
              onSave={handleSaveBasics}
              isSaving={updateCustomStageName.isPending}
            />
          </TabsContent>
          
          <TabsContent value="team" className="mt-6">
            {job && jhsId && (
              <TeamTab 
                jhsId={jhsId} 
                jobId={jobId}
                organizationId={job.organization_id}
              />
            )}
          </TabsContent>
          
          <TabsContent value="automations" className="mt-6">
            {job?.organization_id && jhsId && (
              <AutomationsTab 
                jhsId={jhsId} 
                jobId={jobId}
                organizationId={job.organization_id}
              />
            )}
          </TabsContent>
          
          <TabsContent value="scorecards" className="mt-6">
            {job && jhsId && (
              <ScorecardsTab 
                jhsId={jhsId} 
                jobId={jobId}
                stageName={config.customStageName || config.stageName}
                stageType={config.stageType}
              />
            )}
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
