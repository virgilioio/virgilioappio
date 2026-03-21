import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobFormSheet } from '@/components/jobs/JobFormSheet'
import { JobWizard } from '@/components/jobs/JobWizard'
import { useJobs, Job } from '@/hooks/useJobs'
import { usePermissions } from '@/hooks/usePermissions'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { AppContainer } from '@/components/layout/AppContainer'

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
      <PermissionGate permission="canViewJobs">
        <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
          <Section variant="default" banded className="shrink-0 animate-fade-in">
            <AppContainer>
              <PageHeader title="Jobs" />
            </AppContainer>
          </Section>

          <Section className="flex-1 min-h-0 overflow-hidden !py-0 animate-fade-in">
            <AppContainer className="h-full min-h-0">
              <div className="py-6 h-full min-h-0 overflow-auto">
                <JobsTable
                  jobs={jobs}
                  isLoading={isLoading}
                  onView={handleView}
                  onEdit={handleEdit}
                  onArchive={handleArchive}
                  onCreateNew={handleCreateNew}
                />
              </div>
            </AppContainer>
          </Section>

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
        </div>
      </PermissionGate>
    </AuthGate>
  )
}