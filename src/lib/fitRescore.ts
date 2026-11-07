import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { announceFitQueueChange } from '@/lib/fitQueueStatus'

/**
 * Gio Fit re-scores (2026-11-07). The database queues them (fit_analysis_queue,
 * process-fit-queue one at a time, about a minute each): a bulk re-score someone
 * asks for goes first (priority 0), new candidates next, and a re-score after a
 * job change last, 10 minutes after the last change (jobs_z_fit_rescore).
 */

/** Above this many, a bulk re-score asks first: each one is a paid assessment. */
export const RESCORE_CONFIRM_ABOVE = 25

const minutes = (n: number) => (n <= 1 ? 'about a minute' : `about ${n} minutes`)

/** The selection bar's "Re-score Gio Fit". Returns how many were queued. */
export async function rescoreCandidates(associationIds: string[]): Promise<number> {
  const ids = [...new Set(associationIds)].filter(Boolean)
  if (!ids.length) return 0
  if (ids.length > RESCORE_CONFIRM_ABOVE) {
    const ok = await confirmDialog({
      title: `Re-score ${ids.length} candidates?`,
      description: `Gio reads each one again against the job: about a minute each, so ${minutes(ids.length)} in all. Each one is a paid assessment. Their current scores stay until the new ones arrive.`,
      confirmLabel: `Re-score ${ids.length}`,
    })
    if (!ok) return 0
  }
  const { data, error } = await supabase.rpc('fit_queue_rescore', { p_association_ids: ids })
  if (error) {
    const denied = error.code === 'GFQ01'
    toast.error(denied ? 'Only people who can edit this job can re-score its candidates.' : 'Couldn’t queue the re-scores. Try again.')
    return 0
  }
  const n = Number(data) || 0
  announceFitQueueChange()
  if (n === 0) toast('Nobody to re-score', { description: 'Rejected and withdrawn candidates aren’t re-scored.' })
  else toast(`Re-scoring ${n} candidate${n === 1 ? '' : 's'}`, {
    description: `${minutes(n)[0].toUpperCase()}${minutes(n).slice(1)}. Their scores update as each one finishes.`,
  })
  return n
}

/**
 * After a save that may have changed what Gio Fit reads: when it queued re-scores,
 * say so with "Don't re-score". One toast per job (later saves update it).
 * Returns true when it showed one.
 */
export async function noticeJobRescore(jobId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fit_queue_job_rescore_pending', { p_job_id: jobId })
  const n = Number(data) || 0
  if (error || n === 0) return false
  announceFitQueueChange()
  toast(`Gio will re-score ${n} candidate${n === 1 ? '' : 's'}`, {
    id: `fit-rescore-${jobId}`,
    description: 'Against the new job details, starting in 10 minutes. Their current scores stay until then.',
    duration: 10_000,
    action: {
      label: 'Don’t re-score',
      onClick: async () => {
        const { error: cancelError } = await supabase.rpc('fit_queue_cancel_job_rescore', { p_job_id: jobId })
        announceFitQueueChange()
        if (cancelError) toast.error('Couldn’t call off the re-score. Try again.')
        else toast('Scores stay as they are', { description: 'Re-score anyone by hand from the selection bar’s ⋯ menu.' })
      },
    },
  })
  return true
}
