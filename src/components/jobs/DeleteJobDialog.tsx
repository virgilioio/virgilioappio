import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive'
import { useRecordCount } from '@/hooks/useRecordCount'

interface DeleteJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kept while the dialog closes so its exit still shows the name. */
  job: { id: string; title?: string | null } | null
  /** Deletes the job. The dialog stays open, with a spinner, until it resolves. */
  onConfirm: () => Promise<void>
  /** Booked interviews block the delete; the dialog offers this instead. */
  onArchiveInstead: () => void
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * J2 / J6 (Block B §16, Pattern 2): deleting a job removes everything under it,
 * so the title has to be typed. What really goes, from the `jobs` foreign keys
 * (2026-10-13): applications with their stage history, scorecards and stage
 * moves; offers and offer approvals; the hiring plan, its stages, automations
 * and interviewers; postings and their forms; openings; hiring-team
 * assignments; comments on this job; the client view link; suggestions. The
 * candidates themselves stay, and the email log, reminders, reference checks
 * and sourcing projects stay but lose the link to the job.
 *
 * Booked interviews block the delete in the database (scheduled_bookings.job_id
 * has no ON DELETE), so the dialog becomes the blocked variant and offers
 * Archive job instead (bug 7, 2026-10-13).
 */
export function DeleteJobDialog({ open, onOpenChange, job, onConfirm, onArchiveInstead }: DeleteJobDialogProps) {
  const id = open ? job?.id ?? null : null
  const bookings = useRecordCount('scheduled_bookings', 'job_id', id)
  const apps = useRecordCount('job_candidate_associations', 'job_id', id)
  const title = job?.title?.trim() || ''
  const label = title || 'this job'

  if (bookings && bookings > 0) {
    return (
      <ConfirmDestructiveDialog
        open={open}
        onOpenChange={onOpenChange}
        variant="blocked"
        title={`${title || 'This job'} can’t be deleted`}
        description={`${plural(bookings, 'interview')} ${bookings === 1 ? 'was' : 'were'} booked for this job, and that history has to stay. Archive it instead: it leaves your active jobs and you can find it in Jobs › Archived.`}
        confirmLabel="Archive job"
        onConfirm={onArchiveInstead}
      />
    )
  }

  const checking = bookings === null || apps === null
  const what = apps
    ? `Its ${plural(apps, 'application')} with their scorecards and stage history, offers, hiring plan, postings, openings and hiring team are deleted with it.`
    : 'Its hiring plan, postings, openings, offers and hiring team are deleted with it.'

  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${label}?`}
      description={
        checking
          ? 'Checking what goes with it…'
          : `${what} The candidates stay in your database, and emails already sent stay in the email log. This can’t be undone.`
      }
      confirmLabel="Delete job"
      typeToConfirm={title || 'delete'}
      onConfirm={async () => {
        try {
          await onConfirm()
        } catch {
          throw new Error(`Couldn’t delete ${label}. Nothing was removed; try again.`)
        }
      }}
    />
  )
}
