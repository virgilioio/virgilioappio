
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobForm } from '@/components/jobs/JobForm'
import { useJobs, Job } from '@/hooks/useJobs'

export default function Jobs() {
  const navigate = useNavigate()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [archiveJobId, setArchiveJobId] = useState<string | null>(null)
  
  const {
    jobs,
    isLoading,
    createJob,
    updateJob,
    archiveJob
  } = useJobs()

  const handleCreateNew = () => {
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
      <PermissionGate permission="canViewJobs">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-token-xl px-token-lg">
            <div className="mb-token-xl">
              <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
              <p className="text-muted-foreground mt-token-sm">
                Manage job postings and track hiring progress
              </p>
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
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Job</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to archive this job? It will be moved to archived status but can be reactivated later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmArchive}>
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
