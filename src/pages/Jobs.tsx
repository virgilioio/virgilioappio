import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { GuestRestriction } from '@/components/auth/GuestRestriction'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobFormSheet } from '@/components/jobs/JobFormSheet'
import { JobWizard } from '@/components/jobs/JobWizard'
import { useJobs, Job } from '@/hooks/useJobs'
import { usePermissions } from '@/hooks/usePermissions'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'

export default function Jobs() {
  const navigate = useNavigate()
  const [isWizardOpen, setIsWizardOpen] = useState(false)
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
    setSelectedJob(null)
    setIsWizardOpen(true)
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
        <div>
          <Section variant="default" banded container className="animate-fade-in">
            <PageHeader title="Jobs" subtitle="Manage job postings and track hiring progress" />
          </Section>

          <Section container className="animate-fade-in">
            <JobsTable
              jobs={jobs}
              isLoading={isLoading}
              onView={handleView}
              onEdit={handleEdit}
              onArchive={handleArchive}
              onCreateNew={handleCreateNew}
            />

            <JobWizard
              isOpen={isWizardOpen}
              onClose={() => setIsWizardOpen(false)}
            />

            <JobFormSheet
              isOpen={isFormOpen}
              onClose={() => {
                setIsFormOpen(false)
                setSelectedJob(null)
              }}
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