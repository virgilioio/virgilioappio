// cache-bust: 8F42B1C3
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { AppContainer } from '@/components/layout/AppContainer'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { IndependentCandidateTable } from '@/components/candidates/IndependentCandidateTable'
import { CandidateFormSheet } from '@/components/candidates/CandidateFormSheet'
import { CandidateMergeDialog } from '@/components/candidates/CandidateMergeDialog'
import { MinimizableBulkUploadDialog } from '@/components/candidates/MinimizableBulkUploadDialog'
import { CSVImportDialog } from '@/components/candidates/CSVImportDialog'

import { useIndependentCandidates, CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
import { usePermissions } from '@/hooks/usePermissions'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'
import { CandidateFilterProvider } from '@/contexts/CandidateFilterContext'

import { toast } from '@/hooks/use-toast'

export default function Candidates() {
  const { canViewCandidates } = usePermissions()
  const { hasRecruiterRole, isPrivileged, isLoading: rolesLoading } = useUserJobRoles()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existing: any
    incoming: any
    merged: any
  } | null>(null)
  
  
  const {
    candidates,
    isLoading,
    error,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    getCandidates
  } = useIndependentCandidates()

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
        
        // Success - open candidate profile in new tab
        if (result?.id) {
          window.open(`/candidates?openCandidate=${result.id}`, '_blank')
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

  // Redirect non-recruiter members away from candidates page
  useEffect(() => {
    if (!rolesLoading && !isPrivileged && !hasRecruiterRole) {
      navigate('/dashboard', { replace: true })
    }
  }, [rolesLoading, isPrivileged, hasRecruiterRole, navigate])

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
        <CandidateFilterProvider>
        <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
          <Section variant="default" banded className="shrink-0 animate-fade-in">
            <AppContainer>
              <PageHeader title="All Candidates" />
            </AppContainer>
          </Section>

          <Section className="flex-1 min-h-0 overflow-hidden !py-0 animate-fade-in">
            <AppContainer className="h-full min-h-0">
              <div className="py-6 h-full min-h-0 overflow-auto">
                <IndependentCandidateTable
                  candidates={candidates}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddNew={handleAddNew}
                  onRefresh={getCandidates}
                  onImportCSV={() => setIsCSVImportOpen(true)}
                  onBulkUpload={() => setIsBulkUploadOpen(true)}
                />
              </div>
            </AppContainer>
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

          {/* CSV Import Dialog */}
          <CSVImportDialog
            isOpen={isCSVImportOpen}
            onClose={() => setIsCSVImportOpen(false)}
            onComplete={() => {
              setIsCSVImportOpen(false)
              getCandidates()
            }}
          />
        </div>
        </CandidateFilterProvider>
      </PermissionGate>
    </AuthGate>
  )
}
