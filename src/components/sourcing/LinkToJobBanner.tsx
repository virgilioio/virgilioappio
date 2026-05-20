import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LinkToJobDialog } from './LinkToJobDialog'

interface LinkToJobBannerProps {
  onLinkToJob: (jobId: string) => Promise<void> | void
  currentJobId?: string | null
}

/**
 * Yellow link-to-job banner shown when a sourcing project is not linked to a job.
 * Dismissible for the session via the "Continue without" action.
 */
export function LinkToJobBanner({ onLinkToJob, currentJobId }: LinkToJobBannerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
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
          <Button size="sm" variant="primary" icon={Link2} onClick={() => setDialogOpen(true)}>
            Link to job
          </Button>
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

      <LinkToJobDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentJobId={currentJobId ?? null}
        onConfirm={async (jobId) => {
          await onLinkToJob(jobId)
          setDialogOpen(false)
        }}
      />
    </>
  )
}
