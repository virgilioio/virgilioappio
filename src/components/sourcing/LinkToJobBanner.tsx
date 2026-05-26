import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  LinkToJobDialog,
  LinkToJobPopoverContent,
  type LinkToJobPayload,
  type EnrichedJob,
} from './LinkToJobDialog'
import { JobWizard } from '@/components/jobs/JobWizard'
import type { SourcingProject } from '@/types/sourcing'

interface LinkToJobBannerProps {
  onLinkToJob: (payload: LinkToJobPayload) => Promise<void> | void
  currentJobId?: string | null
  project?: SourcingProject | null
  savedCandidatesCount?: number
  organizationName?: string
}

/**
 * Yellow link-to-job banner shown when a sourcing project is not linked to a job.
 * Clicking "Link to job" opens an anchored popover (Step 1 — job picker), which
 * hands off to a centered dialog (Step 2 — default stage + backfill).
 */
export function LinkToJobBanner({
  onLinkToJob,
  currentJobId,
  project,
  savedCandidatesCount,
  organizationName,
}: LinkToJobBannerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [stageDialogOpen, setStageDialogOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [pickedJob, setPickedJob] = useState<EnrichedJob | null>(null)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/25 text-warning-foreground">
          <Link2 className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary">
            <span className="font-medium">Not linked to a job.</span>{' '}
            <span className="text-text-secondary">
              Collected candidates will sit in this project. Link a job to route them into a pipeline.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="primary" icon={Link2}>
                Link to job
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[460px] p-0"
              onOpenAutoFocus={(e) => {
                // let the search input handle autofocus
                e.preventDefault()
              }}
            >
              <LinkToJobPopoverContent
                project={project}
                onClose={() => setPopoverOpen(false)}
                onSelect={(job) => {
                  setPickedJob(job)
                  setPopoverOpen(false)
                  setTimeout(() => setStageDialogOpen(true), 50)
                }}
                onCreateNew={() => {
                  setPopoverOpen(false)
                  setTimeout(() => setWizardOpen(true), 50)
                }}
              />
            </PopoverContent>
          </Popover>


          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Continue without
          </Button>
          <Button
            size="xs"
            variant="ghost"
            iconOnly
            icon={X}
            aria-label="Dismiss banner"
            onClick={() => setDismissed(true)}
          />
        </div>
      </div>

      {/* Step 2 — Stage + backfill, opens after a job is picked in the popover */}
      <LinkToJobDialog
        open={stageDialogOpen}
        onOpenChange={(o) => {
          setStageDialogOpen(o)
          if (!o) setPickedJob(null)
        }}
        currentJobId={currentJobId ?? null}
        project={project}
        savedCandidatesCount={savedCandidatesCount}
        organizationName={organizationName}
        pickedJob={pickedJob}
        onBackToPick={() => {
          setStageDialogOpen(false)
          setTimeout(() => setPopoverOpen(true), 50)
        }}
        onConfirm={async (payload) => {
          await onLinkToJob(payload)
          setStageDialogOpen(false)
          setPickedJob(null)
        }}
      />

      <JobWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </>
  )
}
