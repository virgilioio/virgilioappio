import { useState, useEffect } from 'react'
import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive'
import { supabase } from '@/lib/supabaseClient'

interface DeleteCandidateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string | null
  candidateName: string
  /** Deletes the candidate. The dialog stays open, with a spinner, until it resolves. */
  onConfirm: () => Promise<void>
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * C1 (Block B §16, Pattern 2): deleting a candidate removes everything attached
 * to them, so the name has to be typed. Applications, scorecards, files, offers,
 * reference checks and reminders go with them; upcoming interviews are cancelled
 * (with emails) before the delete; the email log keeps what was already sent.
 */
export function DeleteCandidateDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onConfirm,
}: DeleteCandidateDialogProps) {
  const [counts, setCounts] = useState<{ apps: number; interviews: number } | null>(null)

  useEffect(() => {
    if (!open || !candidateId) {
      setCounts(null)
      return
    }
    let live = true
    Promise.all([
      supabase
        .from('job_candidate_associations')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidateId),
      supabase
        .from('scheduled_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidateId)
        .in('status', ['confirmed', 'rescheduled'])
        .gte('scheduled_start', new Date().toISOString()),
    ]).then(([a, b]) => {
      if (live) setCounts({ apps: a.count ?? 0, interviews: b.count ?? 0 })
    })
    return () => {
      live = false
    }
  }, [open, candidateId])

  const name = candidateName.trim()
  const what = counts?.apps
    ? `Their ${plural(counts.apps, 'application')}, scorecards, files, offers and reference checks are deleted with them.`
    : 'Their scorecards, files, offers and reference checks are deleted with them.'
  const interviews = counts?.interviews
    ? ` ${plural(counts.interviews, 'upcoming interview')} ${counts.interviews === 1 ? 'is' : 'are'} cancelled and everyone on ${counts.interviews === 1 ? 'it' : 'them'} is emailed.`
    : ''

  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${name || 'this candidate'}?`}
      description={
        counts === null
          ? 'Checking what goes with them…'
          : `${what}${interviews} Emails already sent stay in the email log. This can’t be undone.`
      }
      confirmLabel="Delete candidate"
      typeToConfirm={name || 'delete'}
      onConfirm={async () => {
        try {
          await onConfirm()
        } catch (e) {
          const msg = e instanceof Error ? e.message : ''
          // Our own messages are specific; anything from the server is not shown raw.
          throw new Error(msg.startsWith('Couldn') ? msg : `Couldn’t delete ${name || 'this candidate'}. Nothing was removed; try again.`)
        }
      }}
    />
  )
}
