import { Archive, XCircle } from 'lucide-react'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { undoToast } from '@/lib/undoToast'
import { toast } from '@/hooks/use-toast'
import { logActivity } from '@/lib/activityLogger'

/**
 * Close and archive a job (Block B §16, Pattern 1 + Undo, 2026-10-13). Both
 * are status changes, so they ask once with the new dialog and then offer Undo,
 * which puts back the status the job had before. The database takes the job's
 * postings offline and turns off shared candidate profiles when a job leaves
 * Open; Undo reopens the job (and its latest posting) but those shared
 * profiles stay off, so the dialog says so.
 */
type JobStatus = 'draft' | 'open' | 'closed' | 'archived'

interface JobRef {
  id: string
  title?: string | null
  /** The status before the change; Undo restores it. */
  status?: string | null
  organization_id?: string | null
}

interface Options {
  queryClient?: QueryClient
  /** Runs after the change is saved (navigate away, refetch…). */
  onDone?: () => void
  /** Runs after Undo has put the status back. */
  onUndone?: () => void
  /** Starts the row's exit (collapseRows) when the change leaves the list on screen. */
  collapse?: () => { done: Promise<void>; revert: () => void }
}

const name = (job: JobRef) => job.title?.trim() || 'this job'

async function setStatus(id: string, status: JobStatus) {
  const { error } = await supabase.from('jobs').update({ status }).eq('id', id)
  if (error) throw error
}

function refresh(queryClient?: QueryClient) {
  queryClient?.invalidateQueries({ queryKey: ['jobs'] })
  queryClient?.invalidateQueries({ queryKey: ['job-postings'] })
  window.dispatchEvent(new CustomEvent('job-detail:refresh'))
}

async function change(job: JobRef, to: 'closed' | 'archived', opts: Options) {
  const from = ((job.status as JobStatus) || 'open') as JobStatus
  const title = name(job)
  const exit = opts.collapse?.()
  try {
    await setStatus(job.id, to)
    await exit?.done
  } catch {
    exit?.revert()
    toast({
      title: `Couldn’t ${to === 'archived' ? 'archive' : 'close'} ${title}. Nothing changed; try again.`,
      variant: 'destructive',
    })
    return false
  }
  void logActivity({
    activityType: to === 'archived' ? 'job_archived' : 'job_updated',
    title: `Job ${to === 'archived' ? 'archived' : 'closed'}: ${title}`,
    description: to === 'archived' ? 'Job moved to archived status' : 'Job closed to new applications',
    entityType: 'job',
    entityId: job.id,
    organizationId: job.organization_id ?? undefined,
    metadata: { previous_status: from, updated_fields: ['status'] },
  })
  refresh(opts.queryClient)
  opts.onDone?.()
  const capital = title === 'this job' ? 'Job' : title
  undoToast(
    `${capital} ${to === 'archived' ? 'archived' : 'closed'}`,
    async () => {
      try {
        await setStatus(job.id, from)
        refresh(opts.queryClient)
        opts.onUndone?.()
      } catch {
        toast({ title: `Couldn’t restore ${title}. Change its status in Edit job › Status.`, variant: 'destructive' })
      }
    },
    to === 'archived' ? 'Find it in Jobs › Archived.' : 'Find it in Jobs › Closed.',
  )
  return true
}

/** J1, J5, J8, J11: archive a job, with Undo. Resolves true once archived. */
export async function archiveJobWithUndo(job: JobRef, opts: Options = {}) {
  const title = name(job)
  const ok = await confirmDestructive({
    variant: 'archive',
    icon: Archive,
    title: `Archive ${title}?`,
    description:
      'It leaves your active jobs and moves to the Archived tab on Jobs. Its postings go offline and shared candidate profiles stop working. Candidates and their applications stay, and you can change it back in Edit job › Status.',
    confirmLabel: 'Archive job',
  })
  if (!ok) return false
  return change(job, 'archived', opts)
}

/** J4, J7, J10: close a job to new applications, with Undo. */
export async function closeJobWithUndo(job: JobRef, opts: Options = {}) {
  const title = name(job)
  const ok = await confirmDestructive({
    variant: 'archive',
    icon: XCircle,
    title: `Close ${title}?`,
    description:
      'It stops taking applications and moves to the Closed tab on Jobs. Its postings go offline and shared candidate profiles stop working. Candidates already in the pipeline stay, and you can reopen it in Edit job › Status.',
    confirmLabel: 'Close job',
  })
  if (!ok) return false
  return change(job, 'closed', opts)
}
