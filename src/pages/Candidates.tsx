
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { IndependentCandidateTable } from '@/components/candidates/IndependentCandidateTable'
import { CandidateFormSheet } from '@/components/candidates/CandidateFormSheet'
import { useIndependentCandidates, CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
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

  const handleSubmit = async (candidateData: CreateIndependentCandidateData & { assignedJobId?: string; assignedStageId?: string }) => {
    try {
      if (selectedCandidate) {
        // For editing, ignore job assignment fields
        const { assignedJobId, assignedStageId, ...updateData } = candidateData
        await updateCandidate(selectedCandidate.id, updateData)
      } else {
        // For new candidates, just create without job assignment (no job context on candidates page)
        const { assignedJobId, assignedStageId, ...createData } = candidateData
        await addCandidate(createData)
      }
      handleFormClose()
    } catch (error) {
      // Error is handled in the hook
      console.error('Error submitting candidate:', error)
    }
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
          <Section variant="default" banded container className="animate-fade-in">
            <PageHeader
              title="All Candidates"
              subtitle="Manage all candidates in your talent database. Use sync to import existing job candidates."
            >
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
            </PageHeader>
          </Section>

          <Section container className="animate-fade-in">
            <IndependentCandidateTable
              candidates={candidates}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddNew={handleAddNew}
              onRefresh={getCandidates}
            />
          </Section>

          <CandidateFormSheet
            isOpen={isFormOpen}
            onClose={handleFormClose}
            onSubmit={handleSubmit}
            candidate={selectedCandidate}
            jobId="" // Independent candidates don't have a job ID
            isLoading={isLoading}
          />
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
