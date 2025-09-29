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
  const { stages, isLoading } = useJobStages(context)

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Stages Library</CardTitle>
            <CardDescription>
              Manage job stages that can be used across jobs in your organization
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
            stages={stages}
            isLoading={isLoading}
            onEdit={handleEdit}
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