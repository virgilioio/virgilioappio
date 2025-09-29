import { JobStagesTable } from './JobStagesTable'
import { JobStageForm } from './JobStageForm'
import { useJobStages } from '@/hooks/useJobStages'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import type { JobStage } from '@/hooks/useJobStages'

export function PlatformJobStagesManager() {
  const { stages, isLoading, createStage, updateStage, deleteStage } = useJobStages('platform-defaults')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<JobStage | null>(null)

  const handleEdit = (stage: JobStage) => {
    setEditingStage(stage)
  }

  const handleCloseEdit = () => {
    setEditingStage(null)
  }

  const handleSaved = () => {
    setIsCreateDialogOpen(false)
    setEditingStage(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Platform Default Job Stages</CardTitle>
          <CardDescription>
            Manage platform-wide default job stages that organizations can inherit. These stages will be automatically added to new jobs.
          </CardDescription>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Default Stage
        </Button>
      </CardHeader>
      <CardContent>
        <JobStagesTable 
          stages={stages} 
          isLoading={isLoading} 
          onEdit={handleEdit}
          onDelete={deleteStage}
          context="platform-defaults"
        />
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Platform Default Stage</DialogTitle>
          </DialogHeader>
          <JobStageForm 
            onCancel={() => setIsCreateDialogOpen(false)}
            onSuccess={handleSaved}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingStage} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Platform Default Stage</DialogTitle>
          </DialogHeader>
          <JobStageForm 
            stage={editingStage}
            onCancel={handleCloseEdit}
            onSuccess={handleSaved}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}