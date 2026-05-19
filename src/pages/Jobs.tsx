import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, SlidersHorizontal } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobFormSheet } from '@/components/jobs/JobFormSheet'
import { JobWizard } from '@/components/jobs/JobWizard'
import { useJobs, Job } from '@/hooks/useJobs'

type StatusSegment = 'active' | 'all' | 'paused' | 'closed' | 'archived'

export default function Jobs() {
  const navigate = useNavigate()
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [archiveJobId, setArchiveJobId] = useState<string | null>(null)
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusSegment>('active')

  const { jobs, isLoading, createJob, updateJob, archiveJob, deleteJob } = useJobs()

  const counts = useMemo(() => {
    const c = { active: 0, all: jobs.length, paused: 0, closed: 0, archived: 0 }
    for (const j of jobs) {
      if (j.status === 'open' || j.status === 'draft') c.active++
      if (j.status === 'draft') c.paused++
      if (j.status === 'closed') c.closed++
      if (j.status === 'archived') c.archived++
    }
    return c
  }, [jobs])

  const handleCreateNew = () => { setSelectedJob(null); setIsWizardOpen(true) }
  const handleView = (job: Job) => navigate(`/jobs/${job.id}`)
  const handleEdit = (job: Job) => { setSelectedJob(job); setIsFormOpen(true) }
  const handleArchive = (id: string) => setArchiveJobId(id)
  const handleConfirmArchive = async () => {
    if (archiveJobId) { await archiveJob(archiveJobId); setArchiveJobId(null) }
  }
  const handleDelete = (id: string) => setDeleteJobId(id)
  const handleConfirmDelete = async () => {
    if (!deleteJobId) return
    setIsDeleting(true)
    try {
      await deleteJob(deleteJobId)
      setDeleteJobId(null)
    } finally {
      setIsDeleting(false)
    }
  }
  const handleFormSubmit = async (data: any) => {
    if (selectedJob) await updateJob(selectedJob.id, data)
    else await createJob(data)
    setIsFormOpen(false); setSelectedJob(null)
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewJobs">
        <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden bg-virgilio-cream">
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8 space-y-6 animate-fade-in">
              {/* Page header */}
              <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h1 className="font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[28px] leading-tight sm:text-[32px]">
                      Jobs<span className="text-virgilio-purple">.</span>
                    </h1>
                    <Badge tone="neutral" size="sm">{jobs.length}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-pastel-green-foreground" />
                      {jobs.filter(j => j.status === 'open').length} open
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-pastel-yellow-foreground" />
                      {counts.paused} paused
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                      {counts.closed} closed
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="md" icon={SlidersHorizontal}>Columns</Button>
                  <Button variant="secondary" size="md" icon={Download}>Export</Button>
                  <PermissionGate permission="canCreateJobs">
                    <Button
                      variant="primary"
                      size="md"
                      icon={Plus}
                      onClick={handleCreateNew}
                    >
                      New job
                    </Button>
                  </PermissionGate>
                </div>
              </header>

              <JobsTable
                jobs={jobs}
                isLoading={isLoading}
                onView={handleView}
                onEdit={handleEdit}
                onArchive={handleArchive}
                onCreateNew={handleCreateNew}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                tabs={[
                  { value: 'all', label: 'All', count: counts.all },
                  { value: 'active', label: 'Active', count: counts.active },
                  { value: 'closed', label: 'Closed', count: counts.closed },
                  { value: 'paused', label: 'Paused', count: counts.paused },
                  { value: 'archived', label: 'Archived', count: counts.archived },
                ]}
              />
            </div>
          </div>

          <JobWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
          <JobFormSheet
            isOpen={isFormOpen}
            onClose={() => { setIsFormOpen(false); setSelectedJob(null) }}
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
