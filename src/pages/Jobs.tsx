
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { GuestRestriction } from '@/components/auth/GuestRestriction'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobForm } from '@/components/jobs/JobForm'
import { JobRequestForm } from '@/components/job-requests/JobRequestForm'
import { ComplianceCheckDialog } from '@/components/job-requests/ComplianceCheckDialog'
import { useJobs, Job } from '@/hooks/useJobs'
import { useJobRequests } from '@/hooks/useJobRequests'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizationProgress } from '@/hooks/useOrganizationProgress'
import { useAuth } from '@/contexts/AuthContext'
import { Briefcase } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'

export default function Jobs() {
  const navigate = useNavigate()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [archiveJobId, setArchiveJobId] = useState<string | null>(null)
  const [showComplianceDialog, setShowComplianceDialog] = useState(false)
  const permissions = usePermissions()
  const { userType } = useAuth()
  const organizationProgress = useOrganizationProgress()
  
  const {
    jobs,
    isLoading,
    createJob,
    updateJob,
    archiveJob
  } = useJobs()

  const { createJobRequest, isLoading: isRequestLoading } = useJobRequests()

  const handleCreateNew = () => {
    // Additional frontend check for workspace owners
    if (permissions.isWorkspaceOwner && !permissions.canCreateJobs) {
      navigate('/job-requests')
      return
    }
    setSelectedJob(null)
    setIsFormOpen(true)
  }

  const handleRequestJob = () => {
    // Check compliance for workspace owners
    if (userType === 'workspace_owner' && !organizationProgress.isComplete) {
      setShowComplianceDialog(true)
      return
    }
    
    setIsRequestFormOpen(true)
  }

  const handleView = (job: Job) => {
    navigate(`/jobs/${job.id}`)
  }

  const handleEdit = (job: Job) => {
    setSelectedJob(job)
    setIsFormOpen(true)
  }

  const handleArchive = (id: string) => {
    setArchiveJobId(id)
  }

  const handleConfirmArchive = async () => {
    if (archiveJobId) {
      await archiveJob(archiveJobId)
      setArchiveJobId(null)
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (selectedJob) {
      await updateJob(selectedJob.id, data)
    } else {
      await createJob(data)
    }
    setIsFormOpen(false)
    setSelectedJob(null)
  }

  const handleJobRequestSubmit = async (data: any) => {
    await createJobRequest(data)
    setIsRequestFormOpen(false)
  }

  return (
    <AuthGate>
      <PermissionGate 
        permission="canViewJobs"
        fallback={
          <GuestRestriction 
            action="view jobs" 
            suggestion="Contact your administrator to request access to job listings."
          />
        }
      >
        <div className="min-h-screen bg-background">
          <Section variant="default" banded container className="animate-fade-in">
            <PageHeader title="Jobs" subtitle="Manage job postings and track hiring progress">
              {/* Extra note for workspace owners without create permission */}
              {permissions.isWorkspaceOwner && !permissions.canCreateJobs && (
                <p className="text-sm text-text-secondary mt-2">
                  Note: To create new jobs, please submit a job request instead.
                </p>
              )}
            </PageHeader>
          </Section>

          <Section container className="animate-fade-in">
            <JobsTable
              jobs={jobs}
              isLoading={isLoading}
              onView={handleView}
              onEdit={handleEdit}
              onArchive={handleArchive}
              onCreateNew={handleCreateNew}
              onRequestJob={handleRequestJob}
            />

            <JobForm
              isOpen={isFormOpen}
              onClose={() => {
                setIsFormOpen(false)
                setSelectedJob(null)
              }}
              onSubmit={handleFormSubmit}
              job={selectedJob}
              isLoading={isLoading}
            />

            <ComplianceCheckDialog
              open={showComplianceDialog}
              onOpenChange={setShowComplianceDialog}
              progress={organizationProgress.progress}
            />

            <Dialog open={isRequestFormOpen} onOpenChange={setIsRequestFormOpen}>
              <DialogContent className="mx-4 max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Request New Job</DialogTitle>
                </DialogHeader>
                <JobRequestForm
                  onSubmit={handleJobRequestSubmit}
                  onCancel={() => setIsRequestFormOpen(false)}
                  isLoading={isRequestLoading}
                />
              </DialogContent>
            </Dialog>

            <AlertDialog open={!!archiveJobId} onOpenChange={() => setArchiveJobId(null)}>
              <AlertDialogContent className="mx-4 max-w-md sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Job</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to archive this job? It will be moved to archived status but can be reactivated later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-3">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmArchive} className="w-full sm:w-auto">
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Section>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
