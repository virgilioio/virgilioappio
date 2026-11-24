import { Archive } from 'lucide-react'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { requestRejectBeforeClosing } from './CloseJobRejectHost'
import { requestCloseReason, type CloseReasonAnswer } from './CloseJobDialog'
import { jobCloseReasonLabel, type JobCloseReason } from '@/lib/jobCloseReasons'
import { toast } from '@/hooks/use-toast'
import { logActivity } from '@/lib/activityLogger'

/**
 * Close and archive a job (Block B §16; Allan, 2026-10-13). Everyone still in
 * the job's pipeline (active or at offer) is rejected first, through the reject
 * form, which says that rejecting can't be undone; cancelling it leaves the
 * job as it was. Before that the Close job dialog asks why (Allan, 2026-11-24:
 * the reason goes on the job, its unfilled openings are cancelled with it and
 * Gio Sales hears about both, all in the database). Archiving a closed job
 * keeps the reason it closed with, so that's a single confirm. There
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
  /** Chosen in the Close job dialog when it opens. */
  preset?: JobCloseReason
  /** After a hire filled the last opening ("All openings for … are filled"). */
  afterHire?: boolean
}

const name = (job: JobRef) => job.title?.trim() || 'this job'

async function setStatus(id: string, status: JobStatus, why?: CloseReasonAnswer | null) {
  const { error } = await supabase
    .from('jobs')
    .update(why ? { status, close_reason: why.reason, close_note: why.note } : { status })
    .eq('id', id)
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

async function change(job: JobRef, to: 'closed' | 'archived', opts: Options, rejected: number, why: CloseReasonAnswer | null) {
  const from = ((job.status as JobStatus) || 'open') as JobStatus
  const title = name(job)
  const exit = opts.collapse?.()
  try {
    await setStatus(job.id, to, why)
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
    metadata: {
      previous_status: from,
      updated_fields: why ? ['status', 'close_reason'] : ['status'],
      rejected_candidates: rejected,
      ...(why ? { close_reason: why.reason, close_note: why.note } : {}),
    },
  })
  refresh(opts.queryClient)
  opts.onDone?.()
  const capital = title === 'this job' ? 'Job' : title
  toast({
    title: `${capital} ${to === 'archived' ? 'archived' : 'closed'}`,
    description: [
      why ? `${jobCloseReasonLabel(why.reason)}.` : '',
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
  const rejectFirst = async () =>
    !remaining.length ||
    requestRejectBeforeClosing({
      jobId: job.id,
      jobTitle: job.title,
      candidateIds: remaining,
      action: to === 'archived' ? 'archive' : 'close',
    })

  // Archiving a closed job keeps the reason it closed with.
  if (job.status === 'closed' && to === 'archived') {
    if (remaining.length) {
      if (!(await rejectFirst())) return false
      return change(job, to, opts, remaining.length, null)
    }
    const ok = await confirmDestructive({
      variant: 'archive',
      icon: Archive,
      title: `Archive ${title}?`,
      description:
        'It moves to the Archived tab on Jobs and keeps the reason it closed with. You can change it back in Edit job \u203a Status.',
      confirmLabel: 'Archive job',
    })
    if (!ok) return false
    return change(job, to, opts, 0, null)
  }

  const why = await requestCloseReason({
    jobId: job.id,
    jobTitle: job.title,
    to,
    preset: opts.preset,
    afterHire: opts.afterHire,
    remaining: remaining.length,
  })
  if (!why) return false
  if (!(await rejectFirst())) return false
  return change(job, to, opts, remaining.length, why)
}

/** J1, J5, J8, J11: archive a job. Resolves true once archived. */
export function archiveJob(job: JobRef, opts: Options = {}) {
  return leaveOpen(job, 'archived', opts)
}

/** J4, J7, J10, C9: close a job to new applications. Resolves true once closed. */
export function closeJob(job: JobRef, opts: Options = {}) {
  return leaveOpen(job, 'closed', opts)
}
