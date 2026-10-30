import type { BadgeTone } from '@/components/ui/badge'
import type { EnvelopeRow, SignKind, SignStatus } from './api'

/** Envelope statuses as people read them, with the house badge tone for each. */
export const ENVELOPE_STATUS: Record<SignStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'purple' },
  queued: { label: 'Sending', tone: 'orange' },
  sent: { label: 'Out for signature', tone: 'orange' },
  completed: { label: 'Completed', tone: 'green' },
  declined: { label: 'Declined', tone: 'red' },
  voided: { label: 'Voided', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

export const ENVELOPE_KIND: Record<SignKind, { label: string }> = {
  customer: { label: 'Customer' },
  candidate: { label: 'Candidate' },
  member: { label: 'Member' },
}

export type EnvelopeFilter = 'all' | 'draft' | 'scheduled' | 'sent' | 'completed' | 'closed'

export const ENVELOPE_FILTERS: { value: EnvelopeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sent', label: 'Out for signature' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
]

const CLOSED: SignStatus[] = ['voided', 'declined', 'expired', 'cancelled']

export function matchesFilter(filter: EnvelopeFilter, status: SignStatus) {
  if (filter === 'all') return true
  if (filter === 'closed') return CLOSED.includes(status)
  if (filter === 'sent') return status === 'sent' || status === 'queued'
  return status === filter
}

export const signersOf = (e: EnvelopeRow) => e.recipients.filter((r) => r.role === 'signer')

/** Who the envelope is waiting on now: the first pending signer or approver in order. */
export function nextPending(e: EnvelopeRow) {
  if (e.status !== 'sent') return []
  const pending = e.recipients.filter((r) => r.role !== 'cc' && r.status !== 'signed' && r.status !== 'approved')
  return e.ordered ? pending.slice(0, 1) : pending
}

export function isWaitingOnMe(e: EnvelopeRow, myEmail: string | null | undefined, myId: string | null | undefined) {
  if (!myEmail && !myId) return false
  const mine = (myEmail ?? '').toLowerCase()
  return nextPending(e).some((r) => (myId && r.user_id === myId) || (mine && r.email === mine))
}

/** "Just now", "12 min ago", "3 h ago", "Yesterday", then "Oct 12". */
export function ago(iso: string, now = Date.now()) {
  const d = now - new Date(iso).getTime()
  const M = 60_000, H = 60 * M, D = 24 * H
  if (d < M) return 'Just now'
  if (d < H) return `${Math.round(d / M)} min ago`
  if (d < D) return `${Math.round(d / H)} h ago`
  if (d < 2 * D) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "just now", "yesterday", "3 h ago" or "Sep 12": `ago` to follow a word, month names kept capitalised. */
export function agoInline(iso: string, now = Date.now()) {
  const v = ago(iso, now)
  return v === 'Just now' || v === 'Yesterday' ? v.toLowerCase() : v
}

export function shortDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
