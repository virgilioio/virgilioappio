
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { GuestRestriction } from '@/components/auth/GuestRestriction'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobForm } from '@/components/jobs/JobForm'
import { useJobs, Job } from '@/hooks/useJobs'
import { usePermissions } from '@/hooks/usePermissions'

export default function Jobs() {
  const navigate = useNavigate()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [archiveJobId, setArchiveJobId] = useState<string | null>(null)
  const permissions = usePermissions()
  
  const {
    jobs,
    isLoading,
    createJob,
    updateJob,
    archiveJob
  } = useJobs()

  const handleCreateNew = () => {
    // Additional frontend check for workspace owners
    if (permissions.isWorkspaceOwner && !permissions.canCreateJobs) {
      navigate('/job-requests')
      return
    }
    setSelectedJob(null)
    setIsFormOpen(true)
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
          <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-6 sm:mb-8 lg:mb-12">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Jobs</h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-md">
                Manage job postings and track hiring progress
              </p>
              {permissions.isWorkspaceOwner && !permissions.canCreateJobs && (
                <p className="text-sm text-muted-foreground mt-2">
                  Note: To create new jobs, please submit a job request instead.
                </p>
              )}
            </div>

            <JobsTable
              jobs={jobs}
              isLoading={isLoading}
              onView={handleView}
              onEdit={handleEdit}
              onArchive={handleArchive}
              onCreateNew={handleCreateNew}
            />

            <JobForm
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              onSubmit={handleFormSubmit}
              job={selectedJob}
              isLoading={isLoading}
            />

            <AlertDialog open={!!archiveJobId} onOpenChange={() => setArchiveJobId(null)}>
              <AlertDialogContent className="mx-4 max-w-md sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Job</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to archive this job? It will be moved to archived status but can be reactivated later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-3">
                  <AlertDialogCancel className="w-full sm:w-auto min-h-[44px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmArchive} className="w-full sm:w-auto min-h-[44px]">
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
