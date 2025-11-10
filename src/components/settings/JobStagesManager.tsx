import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { JobStageForm } from './JobStageForm'
import { JobStagesTable } from './JobStagesTable'
import { useJobStages, JobStage } from '@/hooks/useJobStages'
import { Plus } from 'lucide-react'

interface JobStagesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function JobStagesManager({ context = 'organization' }: JobStagesManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
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
    setIsCreateDialogOpen(false)
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
            <JobStagesTable 
              stages={platformStages} 
              isLoading={isLoading} 
              onEdit={() => {}}
              onCopy={handleCopy}
              context={context}
              readOnly
            />
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
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Stage
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Stage</DialogTitle>
                <DialogDescription>
                  Add a new stage to the stages library
                </DialogDescription>
              </DialogHeader>
              <JobStageForm
                onSuccess={handleCreateSuccess}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <JobStagesTable 
            stages={context === 'organization' ? tenantStages : stages} 
            isLoading={isLoading} 
            onEdit={handleEdit}
            context={context}
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingStage} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
            <DialogDescription>
              Update the stage details
            </DialogDescription>
          </DialogHeader>
          {editingStage && (
            <JobStageForm
              stage={editingStage}
              onSuccess={handleUpdateSuccess}
              onCancel={handleCloseEdit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}