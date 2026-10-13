import { Archive, XCircle } from 'lucide-react'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { requestRejectBeforeClosing } from './CloseJobRejectHost'
import { toast } from '@/hooks/use-toast'
import { logActivity } from '@/lib/activityLogger'

/**
 * Close and archive a job (Block B §16; Allan, 2026-10-13). Everyone still in
 * the job's pipeline (active or at offer) is rejected first, through the reject
 * form, which says that rejecting can't be undone; cancelling it leaves the
 * job as it was. With nobody left in the pipeline it's a single confirm. There
 * is no Undo: the database switches off shared candidate profiles and takes
 * postings offline when a job leaves Open, which reopening doesn't restore.
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

/** Candidates still in the job's pipeline (not rejected or hired). Null if unknown. */
async function remainingCandidates(jobId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('job_candidate_associations')
    .select('candidate_id')
    .eq('job_id', jobId)
    .in('status', ['active', 'offer'])
  if (error) return null
  return [...new Set((data ?? []).map((r) => r.candidate_id as string))]
}

/**
 * Before a job leaves Open some other way (Edit job › Status): rejects whoever
 * is still in its pipeline. Resolves true when there was nobody or the
 * rejections were saved; false if cancelled or the pipeline couldn't be read.
 */
export async function rejectRemainingBeforeStatus(job: JobRef, to: 'closed' | 'archived'): Promise<boolean> {
  const remaining = await remainingCandidates(job.id)
  if (remaining === null) {
    toast({ title: `Couldn\u2019t check who\u2019s still in ${name(job)}\u2019s pipeline. Nothing changed; try again.`, variant: 'destructive' })
    return false
  }
  if (!remaining.length) return true
  return requestRejectBeforeClosing({
    jobId: job.id,
    jobTitle: job.title,
    candidateIds: remaining,
    action: to === 'archived' ? 'archive' : 'close',
  })
}

async function change(job: JobRef, to: 'closed' | 'archived', opts: Options, rejected: number) {
  const from = ((job.status as JobStatus) || 'open') as JobStatus
  const title = name(job)
  const exit = opts.collapse?.()
  try {
    await setStatus(job.id, to)
    await exit?.done
  } catch {
    exit?.revert()
    toast({
      title: rejected
        ? `The candidates were rejected, but ${title} couldn\u2019t be ${to === 'archived' ? 'archived' : 'closed'}. Try again.`
        : `Couldn\u2019t ${to === 'archived' ? 'archive' : 'close'} ${title}. Nothing changed; try again.`,
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
    metadata: { previous_status: from, updated_fields: ['status'], rejected_candidates: rejected },
  })
  refresh(opts.queryClient)
  opts.onDone?.()
  const capital = title === 'this job' ? 'Job' : title
  toast({
    title: `${capital} ${to === 'archived' ? 'archived' : 'closed'}`,
    description: [
      rejected ? `${rejected} candidate${rejected === 1 ? '' : 's'} rejected.` : '',
      to === 'archived' ? 'Find it in Jobs \u203a Archived.' : 'Find it in Jobs \u203a Closed.',
    ].filter(Boolean).join(' '),
  })
  return true
}

async function leaveOpen(job: JobRef, to: 'closed' | 'archived', opts: Options) {
  const title = name(job)
  const remaining = await remainingCandidates(job.id)
  if (remaining === null) {
    toast({ title: `Couldn\u2019t check who\u2019s still in ${title}\u2019s pipeline. Nothing changed; try again.`, variant: 'destructive' })
    return false
  }
  if (remaining.length) {
    const done = await requestRejectBeforeClosing({
      jobId: job.id,
      jobTitle: job.title,
      candidateIds: remaining,
      action: to === 'archived' ? 'archive' : 'close',
    })
    if (!done) return false
    return change(job, to, opts, remaining.length)
  }
  const ok = await confirmDestructive(
    to === 'archived'
      ? {
          variant: 'archive',
          icon: Archive,
          title: `Archive ${title}?`,
          description:
            'Nobody is left in its pipeline. It moves to the Archived tab on Jobs, its postings go offline and shared candidate profiles stop working. You can change it back in Edit job \u203a Status.',
          confirmLabel: 'Archive job',
        }
      : {
          variant: 'archive',
          icon: XCircle,
          title: `Close ${title}?`,
          description:
            'Nobody is left in its pipeline. It stops taking applications and moves to the Closed tab on Jobs; its postings go offline and shared candidate profiles stop working. You can reopen it in Edit job \u203a Status.',
          confirmLabel: 'Close job',
        },
  )
  if (!ok) return false
  return change(job, to, opts, 0)
}

/** J1, J5, J8, J11: archive a job. Resolves true once archived. */
export function archiveJob(job: JobRef, opts: Options = {}) {
  return leaveOpen(job, 'archived', opts)
}

/** J4, J7, J10, C9: close a job to new applications. Resolves true once closed. */
export function closeJob(job: JobRef, opts: Options = {}) {
  return leaveOpen(job, 'closed', opts)
}
