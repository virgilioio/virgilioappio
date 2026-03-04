import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { JobStageForm } from './JobStageForm'
import { JobStagesTable } from './JobStagesTable'
import { useJobStages, JobStage } from '@/hooks/useJobStages'
import { Plus } from 'lucide-react'

interface JobStagesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function JobStagesManager({ context = 'organization' }: JobStagesManagerProps) {
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<JobStage | null>(null)
  const { stages, isLoading, copyPlatformTemplate } = useJobStages(context)

  const platformStages = stages?.filter(s => s.source === 'platform')
  const tenantStages = stages?.filter(s => s.source === 'tenant')

  const handleEdit = (stage: JobStage) => {
    setEditingStage(stage)
  }

  const handleCloseEdit = () => {
    setEditingStage(null)
  }

  const handleCreateSuccess = () => {
    setIsCreateSheetOpen(false)
  }

  const handleUpdateSuccess = () => {
    setEditingStage(null)
  }

  const handleCopy = async (stageId: string) => {
    await copyPlatformTemplate(stageId)
  }

  return (
    <div className="space-y-6">
      {context === 'organization' && platformStages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Library</CardTitle>
            <CardDescription>
              Default stages provided by the platform. Copy to your library to customize.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <JobStagesTable 
                stages={platformStages} 
                isLoading={isLoading} 
                onEdit={() => {}}
                onCopy={handleCopy}
                context={context}
                readOnly
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {context === 'organization' ? 'My Library' : 'Stages Library'}
            </CardTitle>
            <CardDescription>
              {context === 'organization' 
                ? 'Custom stages for your organization'
                : 'Manage job stages that can be used across jobs in your organization'
              }
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateSheetOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Stage
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <JobStagesTable 
              stages={context === 'organization' ? tenantStages : stages} 
              isLoading={isLoading} 
              onEdit={handleEdit}
              context={context}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create Sheet */}
      <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create New Stage</SheetTitle>
            <SheetDescription>
              Add a new stage to the stages library
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <JobStageForm
              onSuccess={handleCreateSuccess}
              onCancel={() => setIsCreateSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={!!editingStage} onOpenChange={(open) => !open && handleCloseEdit()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Stage</SheetTitle>
            <SheetDescription>
              Update the stage details
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {editingStage && (
              <JobStageForm
                stage={editingStage}
                onSuccess={handleUpdateSuccess}
                onCancel={handleCloseEdit}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
