import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  LinkToJobPopoverContent,
  LinkToJobStagePopoverContent,
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
 * Clicking "Link to job" opens an anchored popover that hosts BOTH steps:
 *   Step 1 — job picker
 *   Step 2 — default stage + backfill
 * The popover body swaps in place to keep a single multi-step floating surface.
 */
export function LinkToJobBanner({
  onLinkToJob,
  project,
  savedCandidatesCount = 0,
  organizationName,
}: LinkToJobBannerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [step, setStep] = useState<'pick' | 'stage'>('pick')
  const [pickedJob, setPickedJob] = useState<EnrichedJob | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleOpenChange = (o: boolean) => {
    setPopoverOpen(o)
    if (!o) {
      // Reset to step 1 the next time the popover opens.
      setStep('pick')
      setPickedJob(null)
    }
  }

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
          <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="primary" icon={Link2}>
                Link to job
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[460px] p-0"
              onOpenAutoFocus={(e) => { e.preventDefault() }}
            >
              {step === 'pick' || !pickedJob ? (
                <LinkToJobPopoverContent
                  project={project}
                  onClose={() => setPopoverOpen(false)}
                  onSelect={(job) => {
                    setPickedJob(job)
                    setStep('stage')
                  }}
                  onCreateNew={() => {
                    setPopoverOpen(false)
                    setTimeout(() => setWizardOpen(true), 50)
                  }}
                />
              ) : (
                <LinkToJobStagePopoverContent
                  job={pickedJob}
                  savedCount={savedCandidatesCount}
                  organizationName={organizationName}
                  onBack={() => setStep('pick')}
                  onConfirm={async (payload) => {
                    await onLinkToJob(payload)
                    setPopoverOpen(false)
                    setStep('pick')
                    setPickedJob(null)
                  }}
                />
              )}
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

      <JobWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </>
  )
}
