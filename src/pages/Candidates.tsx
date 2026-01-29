
import { useState } from 'react'
import { RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { IndependentCandidateTable } from '@/components/candidates/IndependentCandidateTable'
import { CandidateFormSheet } from '@/components/candidates/CandidateFormSheet'
import { CandidateMergeDialog } from '@/components/candidates/CandidateMergeDialog'
import { MinimizableBulkUploadDialog } from '@/components/candidates/MinimizableBulkUploadDialog'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { useIndependentCandidates, CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
import { usePermissions } from '@/hooks/usePermissions'
import { useCandidateSync } from '@/hooks/useCandidateSync'
import { toast } from '@/hooks/use-toast'

export default function Candidates() {
  const { canViewCandidates } = usePermissions()
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existing: any
    incoming: any
    merged: any
  } | null>(null)
  
  // State for opening profile sheet after candidate creation
  const [newCandidateId, setNewCandidateId] = useState<string | null>(null)
  const [newCandidateJobId, setNewCandidateJobId] = useState<string | null>(null)
  const [showNewCandidateSheet, setShowNewCandidateSheet] = useState(false)
  
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
      let result
      if (selectedCandidate) {
        // For editing, ignore job assignment fields
        const { assignedJobId, assignedStageId, ...updateData } = candidateData
        result = await updateCandidate(selectedCandidate.id, updateData)
        handleFormClose()
      } else {
        // For new candidates, just create without job assignment (no job context on candidates page)
        const { assignedJobId, assignedStageId, ...createData } = candidateData
        result = await addCandidate(createData)
        
        // Check if duplicate was detected
        if (result && 'isDuplicate' in result) {
          setDuplicateInfo({
            existing: result.existingCandidate,
            incoming: result.incomingData,
            merged: result.mergedData
          })
          setShowMergeDialog(true)
          return null // Don't close the form yet
        }
        
        // Success - capture candidate info and open profile sheet
        if (result?.id) {
          setNewCandidateId(result.id)
          setNewCandidateJobId(assignedJobId || null)
          setShowNewCandidateSheet(true)
        }
        
        handleFormClose()
      }
      return result // Return the result so CandidateFormSheet can access the candidate ID
    } catch (error) {
      // Error is handled in the hook
      console.error('Error submitting candidate:', error)
      throw error // Re-throw so CandidateFormSheet knows there was an error
    }
  }

  const handleMergeConfirm = async () => {
    if (!duplicateInfo) return
    
    try {
      await updateCandidate(duplicateInfo.existing.id, duplicateInfo.merged)
      setShowMergeDialog(false)
      setDuplicateInfo(null)
      handleFormClose()
      toast({
        title: 'Success',
        description: 'Candidate merged successfully!'
      })
    } catch (error) {
      console.error('Error merging candidate:', error)
      toast({
        title: 'Error',
        description: 'Failed to merge candidate',
        variant: 'destructive'
      })
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
              <div className="flex gap-2">
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
                <Button
                  onClick={() => setIsBulkUploadOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </Button>
              </div>
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

          {/* Merge Dialog */}
          {duplicateInfo && (
            <CandidateMergeDialog
              isOpen={showMergeDialog}
              onConfirm={handleMergeConfirm}
              onCancel={() => {
                setShowMergeDialog(false)
                setDuplicateInfo(null)
              }}
              existingCandidate={duplicateInfo.existing}
              newCandidate={duplicateInfo.incoming}
              mergedCandidate={duplicateInfo.merged}
            />
          )}

          {/* Bulk Upload Dialog */}
          <MinimizableBulkUploadDialog
            isOpen={isBulkUploadOpen}
            onClose={() => setIsBulkUploadOpen(false)}
            onComplete={() => {
              setIsBulkUploadOpen(false)
              getCandidates()
            }}
          />

          {/* Profile Sheet for newly created candidate */}
          <UniversalCandidateProfileSheet
            open={showNewCandidateSheet}
            onOpenChange={setShowNewCandidateSheet}
            candidateId={newCandidateId}
            jobId={newCandidateJobId}
            context={newCandidateJobId ? 'job' : 'independent'}
          />
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
