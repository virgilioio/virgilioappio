import { JobStagesTable } from './JobStagesTable'
import { JobStageForm } from './JobStageForm'
import { useJobStages } from '@/hooks/useJobStages'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus } from 'lucide-react'
import type { JobStage } from '@/hooks/useJobStages'

export function PlatformJobStagesManager() {
  const { stages, isLoading, createStage, updateStage, deleteStage } = useJobStages('platform-defaults')
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<JobStage | null>(null)

  const handleEdit = (stage: JobStage) => {
    setEditingStage(stage)
  }

  const handleCloseEdit = () => {
    setEditingStage(null)
  }

  const handleSaved = () => {
    setIsCreateSheetOpen(false)
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
        <Button onClick={() => setIsCreateSheetOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Default Stage
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <JobStagesTable 
            stages={stages} 
            isLoading={isLoading} 
            onEdit={handleEdit}
            onDelete={deleteStage}
            context="platform-defaults"
          />
        </div>
      </CardContent>

      {/* Create Sheet */}
      <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create Platform Default Stage</SheetTitle>
            <SheetDescription>
              Add a new default stage to the platform library
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <JobStageForm 
              onCancel={() => setIsCreateSheetOpen(false)}
              onSuccess={handleSaved}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={!!editingStage} onOpenChange={(open) => !open && handleCloseEdit()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Platform Default Stage</SheetTitle>
            <SheetDescription>
              Update the stage details
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {editingStage && (
              <JobStageForm 
                stage={editingStage}
                onCancel={handleCloseEdit}
                onSuccess={handleSaved}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
