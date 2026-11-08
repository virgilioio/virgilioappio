import { useQuery, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

/**
 * Scheduled emails (2026-11-08). A rejection email sent "Later" waits in
 * scheduled_emails; the rejection banner shows it and can cancel it
 * (scheduled_email_cancel / scheduled_email_uncancel, for the people who can reject
 * candidates on the job). Restoring the candidate cancels it in the database
 * (jca_z_restore_email), and the Activity feed carries one line per scheduled email
 * (scheduled_emails_z_activity, activity type candidate_email_scheduled).
 */
export type ScheduledEmailStatus = 'pending' | 'sent' | 'cancelled' | 'failed'

export interface RejectionEmail {
  id: string
  status: ScheduledEmailStatus
  scheduledFor: string
  sentAt: string | null
  cancelReason: 'cancelled' | 'restored' | null
}

export const rejectionEmailKey = (associationId: string | null | undefined, rejectedAt?: string | null) =>
  rejectedAt === undefined ? (['rejection-email', associationId] as const) : (['rejection-email', associationId, rejectedAt] as const)

/**
 * The rejection email scheduled with this rejection (and visible to you), if any.
 * Only emails scheduled since the candidate was rejected count, so an email from an
 * earlier rejection never reads as this one's.
 */
export function useRejectionEmail(associationId: string | null | undefined, rejectedAt: string | null | undefined) {
  return useQuery({
    queryKey: rejectionEmailKey(associationId, rejectedAt ?? null),
    enabled: !!associationId && !!rejectedAt,
    staleTime: 15_000,
    queryFn: async (): Promise<RejectionEmail | null> => {
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select('id, status, scheduled_for, sent_at, cancel_reason')
        .eq('association_id', associationId!)
        .eq('email_type', 'rejection')
        // A little slack: the email can be written a moment before rejected_at is.
        .gte('created_at', new Date(new Date(rejectedAt!).getTime() - 5 * 60_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        id: data.id,
        status: data.status as ScheduledEmailStatus,
        scheduledFor: data.scheduled_for,
        sentAt: data.sent_at,
        cancelReason: (data.cancel_reason as RejectionEmail['cancelReason']) ?? null,
      }
    },
  })
}

/** "Mon, Nov 9 at 9:00 AM" in the viewer's time zone (the year when it isn't this one). */
export function scheduledWhen(iso: string): string {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} at ${time}`
}

export type RejectionEmailView =
  | { kind: 'scheduled'; when: string; canCancel: boolean }
  | { kind: 'sent' }
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  | { kind: 'none' }

/**
 * What the banner says about the email: the scheduled row when there is one, else
 * the application's own record (an email sent at once, or a row you can't read).
 */
export function rejectionEmailView(
  row: RejectionEmail | null | undefined,
  fallback: { sentAt: string | null; scheduledFor: string | null },
): RejectionEmailView {
  if (row) {
    if (row.status === 'pending') return { kind: 'scheduled', when: scheduledWhen(row.scheduledFor), canCancel: true }
    if (row.status === 'sent') return { kind: 'sent' }
    if (row.status === 'failed') return fallback.sentAt ? { kind: 'sent' } : { kind: 'failed' }
    if (row.status === 'cancelled') return fallback.sentAt ? { kind: 'sent' } : { kind: 'cancelled' }
  }
  if (fallback.sentAt) return { kind: 'sent' }
  if (fallback.scheduledFor) return { kind: 'scheduled', when: scheduledWhen(fallback.scheduledFor), canCancel: false }
  return { kind: 'none' }
}

/** The sentence after the reason on the rejection banner. */
export function rejectionEmailSentence(view: RejectionEmailView): string {
  switch (view.kind) {
    case 'scheduled': return `Rejection email goes out ${view.when}.`
    case 'sent': return 'Rejection email sent.'
    case 'cancelled': return 'Rejection email cancelled.'
    case 'failed': return 'Rejection email couldn’t be sent.'
    default: return ''
  }
}

/** The Rejection details tab's "Notified candidate". */
export function rejectionEmailNotified(view: RejectionEmailView): string {
  switch (view.kind) {
    case 'scheduled': return `Not yet · Email goes out ${view.when}`
    case 'sent': return 'Yes · Email'
    case 'cancelled': return 'No · Email cancelled'
    case 'failed': return 'No · Email couldn’t be sent'
    default: return 'No'
  }
}

const MESSAGES: Record<string, string> = {
  GSE01: 'Couldn’t find that email.',
  GSE02: 'This email isn’t waiting to go out any more.',
  GSE03: 'Its send time has passed.',
  GSE04: 'The candidate isn’t rejected any more.',
}

/** A message to show for a failed cancel or undo, never the server's own text. */
export function scheduledEmailError(error: { code?: string } | null | undefined, fallback: string): string {
  return (error?.code && MESSAGES[error.code]) || fallback
}

export async function cancelScheduledEmail(id: string) {
  const { error } = await supabase.rpc('scheduled_email_cancel', { p_id: id })
  return error
}

export async function uncancelScheduledEmail(id: string) {
  const { error } = await supabase.rpc('scheduled_email_uncancel', { p_id: id })
  return error
}

/** Everything that shows a scheduled email: the banner, the feed and the job's lists. */
export function refreshScheduledEmailViews(qc: QueryClient, associationId: string | null | undefined) {
  void qc.invalidateQueries({ queryKey: rejectionEmailKey(associationId) })
  void qc.invalidateQueries({ queryKey: ['activity-feed'] })
  void qc.invalidateQueries({ queryKey: ['job-candidates'] })
  void qc.invalidateQueries({ queryKey: ['pipeline'] })
}
