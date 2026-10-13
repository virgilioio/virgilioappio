import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Download, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobFormSheet } from '@/components/jobs/JobFormSheet'
import { JobWizard } from '@/components/jobs/JobWizard'
import { useJobs, Job } from '@/hooks/useJobs'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { toast } from '@/hooks/use-toast'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { DeleteJobDialog } from '@/components/jobs/DeleteJobDialog'
import { archiveJobWithUndo } from '@/components/jobs/jobStatusActions'

import type { StatusSegment } from '@/components/jobs/JobsTable'

export default function Jobs() {
  const navigate = useNavigate()
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  // Kept after close so the dialog can play its exit with the title still in it.
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusSegment>('active')

  const { jobs, isLoading, error: jobsError, getJobs, createJob, updateJob, deleteJob } = useJobs()
  const queryClient = useQueryClient()
  // §16: an error with nothing loaded, or a first load past 15s, shows Retry — not "No open jobs".
  const [jobsRetry, setJobsRetry] = useState(0)
  const jobsTimedOut = useLoadTimeout(isLoading, jobsRetry)
  const jobsLoadError: 'failed' | 'timeout' | null =
    jobsError && jobs.length === 0 ? 'failed' : jobsTimedOut ? 'timeout' : null

  const counts = useMemo(() => {
    const c = { active: 0, all: jobs.length, drafts: 0, salesDrafts: 0, closed: 0, archived: 0 }
    for (const j of jobs) {
      if (j.status === 'open') c.active++
      if (j.status === 'draft') { c.drafts++; if (j.sales_deal_id) c.salesDrafts++ }
      if (j.status === 'closed') c.closed++
      if (j.status === 'archived') c.archived++
    }
    return c
  }, [jobs])

  const [resumeJobId, setResumeJobId] = useState<string | null>(null)
  const handleCreateNew = () => { setSelectedJob(null); setResumeJobId(null); setIsWizardOpen(true) }
  const handleResumeDraft = (job: Job) => { setResumeJobId(job.id); setIsWizardOpen(true) }
  const handleSetupDraft = (job: Job) => navigate(`/jobs/${job.id}/setup`)
  const handleAssignOwner = (job: Job) => navigate(`/jobs/${job.id}/setup#hiring-team`)
  // J3 (Block B §16, Pattern 1): a draft is a real job row, so discarding it
  // deletes what was set up on it so far. The row collapses while it goes.
  const handleDiscardDraft = async (job: Job) => {
    const title = job.title?.trim() || 'this draft'
    const ok = await confirmDestructive({
      title: `Discard ${title}?`,
      description: 'The draft is deleted with everything set up on it so far: its hiring plan, hiring team, openings and any postings. This can’t be undone.',
      confirmLabel: 'Discard draft',
    })
    if (!ok) return
    const exit = collapseRows(rowsById([job.id]))
    try {
      await deleteJob(job.id, { quiet: true })
      toast({ title: `${title === 'this draft' ? 'Draft' : title} discarded` })
    } catch {
      exit.revert()
      toast({ title: `Couldn’t discard ${title}. Nothing was removed; try again.`, variant: 'destructive' })
    }
  }
  const handleView = (job: Job) => navigate(`/jobs/${job.id}`)
  const handleEdit = (job: Job) => { setSelectedJob(job); setIsFormOpen(true) }
  // J1 (Pattern 1 + Undo): archiving is a status change. The row leaves the
  // tabs that don't show archived jobs; Undo puts the previous status back.
  const handleArchive = (id: string) => {
    const job = jobs.find((j) => j.id === id)
    if (!job) return
    const leaves = statusFilter !== 'all' && statusFilter !== 'archived'
    void archiveJobWithUndo(job, {
      queryClient,
      collapse: leaves ? () => collapseRows(rowsById([id])) : undefined,
      // If the row is still mounted when Undo lands, bring it back in place.
      onUndone: leaves
        ? () => {
            const rows = rowsById([id])
            rows.forEach((el) => { if (el instanceof HTMLElement) el.style.display = '' })
            restoreRows(rows)
          }
        : undefined,
    })
  }
  // J2 (Pattern 2): type the title to delete; booked interviews block it.
  const handleDelete = (id: string) => {
    const job = jobs.find((j) => j.id === id)
    if (!job) return
    setDeleteTarget(job)
    setDeleteOpen(true)
  }
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await deleteJob(deleteTarget.id, { quiet: true })
    toast({ title: `${deleteTarget.title?.trim() || 'Job'} deleted` })
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
            <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8 space-y-6">
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
                      <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                      {counts.closed} closed
                    </span>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('drafts')}
                      className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors"
                    >
                      <span className="h-2 w-2 rounded-full border-[1.5px] border-dashed border-[#8B8F9E]" />
                      {counts.drafts} {counts.drafts === 1 ? 'draft' : 'drafts'}
                    </button>
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
                onDelete={handleDelete}
                onCreateNew={handleCreateNew}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                tabs={[
                  { value: 'active', label: 'Active', count: counts.active },
                  { value: 'drafts', label: 'Drafts', count: counts.drafts, dot: counts.salesDrafts > 0 ? 'Sent from Gio Sales' : undefined },
                  { value: 'all', label: 'All', count: counts.all },
                  { value: 'closed', label: 'Closed', count: counts.closed },
                  { value: 'archived', label: 'Archived', count: counts.archived },
                ]}
                onResumeDraft={handleResumeDraft}
                onSetupDraft={handleSetupDraft}
                onAssignOwner={handleAssignOwner}
                onDiscardDraft={(j) => void handleDiscardDraft(j)}
                loadError={jobsLoadError}
                onRetry={() => { setJobsRetry((n) => n + 1); getJobs() }}
              />
            </div>
          </div>

          <JobWizard isOpen={isWizardOpen} resumeJobId={resumeJobId} onClose={() => { setIsWizardOpen(false); setResumeJobId(null) }} />

          <JobFormSheet
            isOpen={isFormOpen}
            onClose={() => { setIsFormOpen(false); setSelectedJob(null) }}
            onSubmit={handleFormSubmit}
            job={selectedJob}
            isLoading={isLoading}
          />

          <DeleteJobDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            job={deleteTarget}
            onConfirm={handleConfirmDelete}
            onArchiveInstead={() => { if (deleteTarget) handleArchive(deleteTarget.id) }}
          />
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
