import { useState } from 'react'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { WorkersTable } from '@/components/workers/WorkersTable'
import { WorkerForm } from '@/components/workers/WorkerForm'
import { WorkerCreationWizard } from '@/components/workers/WorkerCreationWizard'
import { useWorkers, Worker } from '@/hooks/useWorkers'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Users } from 'lucide-react'

export default function Workers() {
  const { workers, isLoading, createWorker, updateWorker, deleteWorker } = useWorkers()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [currentWizardStep, setCurrentWizardStep] = useState(1)

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker)
    setIsFormOpen(true)
  }

  const handleCreate = () => {
    setEditingWorker(null)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (editingWorker) {
        await updateWorker(editingWorker.id, data)
      } else {
        // For new workers, we need to ensure organization_id is set
        // This should be handled by the form or defaulted to user's organization
        await createWorker(data)
      }
      setIsFormOpen(false)
      setEditingWorker(null)
    } catch (error) {
      console.error('Error saving worker:', error)
    }
  }

  const handleViewProfile = (worker: Worker) => {
    // TODO: Navigate to worker profile page
    console.log('Opening profile for:', worker.full_name)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this worker?')) {
      try {
        await deleteWorker(id)
      } catch (error) {
        console.error('Error deleting worker:', error)
      }
    }
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingWorker(null)
  }

  return (
    <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 sm:h-7 sm:w-7" />
            Workers
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-md">
            Manage your organization's workforce
          </p>
        </div>
        
        <PermissionGate permission="canCreateWorkers">
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Worker
          </Button>
        </PermissionGate>
      </div>

      <PermissionGate permission="canViewWorkers">
        <WorkersTable
          workers={workers}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onViewProfile={handleViewProfile}
          onAddNew={handleCreate}
        />
      </PermissionGate>

      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className={`max-h-[90vh] overflow-y-auto ${!editingWorker && currentWizardStep === 3 ? 'max-w-6xl' : 'max-w-2xl'}`}>
          {editingWorker ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit Worker</DialogTitle>
              </DialogHeader>
              <WorkerForm
                worker={editingWorker}
                onSubmit={handleSubmit}
                onCancel={handleCloseForm}
              />
            </>
          ) : (
            <WorkerCreationWizard
              onSubmit={handleSubmit}
              onCancel={handleCloseForm}
              onStepChange={setCurrentWizardStep}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}