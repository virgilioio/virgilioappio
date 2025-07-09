
import { useState } from 'react'
import { Users, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { IndependentCandidateTable } from '@/components/candidates/IndependentCandidateTable'
import { IndependentCandidateForm } from '@/components/candidates/IndependentCandidateForm'
import { useIndependentCandidates } from '@/hooks/useIndependentCandidates'
import { usePermissions } from '@/hooks/usePermissions'
import { useCandidateSync } from '@/hooks/useCandidateSync'

export default function Candidates() {
  const { canViewCandidates } = usePermissions()
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  const {
    candidates,
    isLoading,
    error,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    getCandidates
  } = useIndependentCandidates()

  const { syncCandidates, isLoading: isSyncing } = useCandidateSync()

  const handleEdit = (candidate: any) => {
    setSelectedCandidate(candidate)
    // TODO: Open candidate edit modal/form
    console.log('Edit candidate:', candidate)
  }

  const handleDelete = async (candidateId: string) => {
    try {
      await deleteCandidate(candidateId)
    } catch (err) {
      console.error('Error deleting candidate:', err)
    }
  }

  const handleAddNew = () => {
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setSelectedCandidate(null)
  }

  const handleSync = async () => {
    const result = await syncCandidates()
    if (result) {
      // Refresh the candidates list after sync
      getCandidates()
    }
  }

  if (error) {
    return (
      <AuthGate>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-destructive">Error loading candidates</div>
            </div>
          </div>
        </div>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-6 sm:mb-8 lg:mb-12">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    All Candidates
                  </h1>
                </div>
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Job Candidates'}
                </Button>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base">
                Manage all candidates in your talent database. Use sync to import existing job candidates.
              </p>
            </div>

            <IndependentCandidateTable
              candidates={candidates}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddNew={handleAddNew}
            />

            <IndependentCandidateForm
              isOpen={isFormOpen}
              onClose={handleFormClose}
              onSubmit={async (data) => {
                await addCandidate(data)
              }}
              isLoading={isLoading}
              initialData={selectedCandidate}
              title={selectedCandidate ? "Edit Candidate" : "Add New Candidate"}
            />
          </div>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
