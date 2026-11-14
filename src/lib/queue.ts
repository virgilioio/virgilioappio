/**
 * The dashboard's "Your queue" (Allan, 2026-11-14): what waits on you, as rows you
 * can act on. Built from the pending activities (scorecards, stage decisions, offer
 * approvals, replies) and the candidates waiting in Application review.
 *
 * Rows come in two groups: Overdue (oldest first), then New (newest first).
 * New applications are one row per job ("8 new applications · Senior Product
 * Designer"); a job with one applicant keeps a row naming them.
 */
import type { PendingActivity } from '@/hooks/usePendingActivities'
import type { NewApplicationItem } from '@/hooks/useNewApplicationsQueue'

export type QueueType = 'scorecard' | 'decision' | 'reply' | 'application'
export type QueueKind = 'scorecard' | 'decision' | 'offer' | 'reply' | 'application' | 'applications'
export type Urgency = 'overdue' | 'today' | 'normal'

export interface QueueApplicant {
  associationId: string
  candidateId: string
  name: string
  enteredAt: string
  dismissKey: string
}

export interface QueueItem {
  id: string
  /** Stable key kept server-side when the row is hidden (dashboard_queue_dismissals). */
  dismissKey: string
  /** Every key hiding this row writes (a job's applications: one per applicant). */
  dismissKeys: string[]
  /** The filter chip it counts under. */
  type: QueueType
  /** What the row is, for its actions. */
  kind: QueueKind
  label: string
  /** The candidate, or for a job's applications the job's title. */
  candidateName: string
  candidateId: string | null
  jobId: string
  jobTitle: string
  context: string
  /** Where the row itself leads. */
  href: string
  urgency: Urgency
  urgencyLabel: string
  /** When it arrived (a group: its newest). New sorts newest first on this. */
  at: string
  /** How long it has waited (a group: its oldest). Overdue sorts oldest first on this. */
  since: string
  associationId?: string
  stageInstanceId?: string
  stageName?: string
  emailId?: string
  messageId?: string
  /** A reply row's conversation (queue_replies, the Inbox's thread id). */
  threadId?: string
  offerStepId?: string
  /** The scorecard is yours to write (admins also see other people's). */
  isOwn?: boolean
  /** Gio has drafted this scorecard from the interview. */
  hasGioDraft?: boolean
  applicants?: QueueApplicant[]
}

const DAY = 86_400_000
const HOUR = 3_600_000

function days(iso: string | null | undefined, now: number): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY))
}

function hours(iso: string | null | undefined, now: number): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / HOUR))
}

/** "just now", "12 min ago", "3h ago", "yesterday", "4 days ago". */
export function ago(iso: string, now: number = Date.now()): string {
  const ms = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(ms / 60_000)
  if (min < 2) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

const cleanJob = (t?: string | null) => (t && t !== 'Unknown Job' ? t : 'No job')

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

export function buildQueue(
  activities: PendingActivity[] | undefined,
  apps: NewApplicationItem[] | undefined,
  now: number = Date.now(),
): QueueItem[] {
  const out: QueueItem[] = []

  for (const a of activities ?? []) {
    const jobTitle = cleanJob(a.jobTitle)
    if (a.type === 'scorecard') {
      const d = days(a.timestamp, now)
      const urgency: Urgency = d >= 1 ? 'overdue' : 'today'
      const key = `scorecard:${a.associationId ?? a.candidateId}:${a.stageInstanceId ?? ''}:${a.interviewerId ?? ''}`
      const theirs = a.isOwnTask === false && a.interviewerName ? ` · ${a.interviewerName}'s` : ''
      out.push({
        id: `s-${a.id}`,
        dismissKey: key,
        dismissKeys: [key],
        type: 'scorecard',
        kind: 'scorecard',
        label: 'Scorecard due',
        candidateName: a.candidateName,
        candidateId: a.candidateId,
        jobId: a.jobId,
        jobTitle,
        context: `${jobTitle}${theirs ? `${theirs} scorecard` : ''} · interviewed ${d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`}`,
        href: `/jobs/${a.jobId}?candidate=${a.candidateId}&open=scorecard&stage=${a.stageInstanceId ?? ''}`,
        urgency,
        urgencyLabel: urgency === 'overdue' ? `${d}d overdue` : 'due today',
        at: a.timestamp,
        since: a.timestamp,
        associationId: a.associationId,
        stageInstanceId: a.stageInstanceId,
        stageName: a.stageName,
        isOwn: a.isOwnTask !== false,
        hasGioDraft: !!a.hasGioDraft,
      })
    } else if (a.type === 'decision') {
      const d = days(a.timestamp, now)
      const urgency: Urgency = d >= 14 ? 'overdue' : d >= 1 ? 'today' : 'normal'
      const key = `decision:${a.associationId ?? a.candidateId}:${a.stageInstanceId ?? ''}`
      out.push({
        id: `d-${a.id}`,
        dismissKey: key,
        dismissKeys: [key],
        type: 'decision',
        kind: 'decision',
        label: 'Stage decision',
        candidateName: a.candidateName,
        candidateId: a.candidateId,
        jobId: a.jobId,
        jobTitle,
        context: `${jobTitle} · ${a.stageName ?? 'Stage'} · scorecard in ${ago(a.timestamp, now)}`,
        href: `/jobs/${a.jobId}?candidate=${a.candidateId}`,
        urgency,
        urgencyLabel: d >= 7 ? `stuck ${d}d` : d > 0 ? `waiting ${d}d` : 'today',
        at: a.timestamp,
        since: a.timestamp,
        associationId: a.associationId,
        stageInstanceId: a.stageInstanceId,
        stageName: a.stageName,
      })
    } else if (a.type === 'offer_approval') {
      // Nothing goes to the candidate until they decide, so a day's wait is overdue (2026-10-17).
      const h = hours(a.timestamp, now)
      const d = Math.floor(h / 24)
      const urgency: Urgency = d >= 1 ? 'overdue' : 'today'
      const key = `offer_approval:${a.id}`
      out.push({
        id: `o-${a.id}`,
        dismissKey: key,
        dismissKeys: [key],
        type: 'decision',
        kind: 'offer',
        label: 'Approve offer',
        candidateName: a.candidateName,
        candidateId: a.candidateId,
        jobId: a.jobId,
        jobTitle,
        context: `${jobTitle} · sent for approval ${ago(a.timestamp, now)}`,
        href: `/jobs/${a.jobId}?candidate=${a.candidateId}&tab=offer`,
        urgency,
        urgencyLabel: d >= 1 ? `waiting ${d}d` : 'today',
        at: a.timestamp,
        since: a.timestamp,
        offerStepId: a.offerStepId,
      })
    } else if (a.type === 'email') {
      const h = hours(a.timestamp, now)
      const d = Math.floor(h / 24)
      const urgency: Urgency = d >= 2 ? 'overdue' : d >= 1 ? 'today' : 'normal'
      // One row per conversation in your own mailbox (queue_replies, 2026-11-14).
      const key = `reply:thread:${a.threadId ?? a.messageId ?? a.emailId ?? a.id}`
      out.push({
        id: `e-${a.id}`,
        dismissKey: key,
        dismissKeys: [key],
        type: 'reply',
        kind: 'reply',
        label: 'Reply needed',
        candidateName: a.candidateName,
        candidateId: a.candidateId,
        jobId: a.jobId,
        jobTitle,
        context: `${jobTitle}${a.emailSubject ? ` · ${a.emailSubject}` : ''}`,
        href: a.jobId
          ? `/jobs/${a.jobId}/candidates/${a.candidateId}?tab=activity`
          : `/candidates/${a.candidateId}?tab=activity`,
        urgency,
        urgencyLabel: d >= 1 ? `waiting ${d}d` : `waiting ${Math.max(1, h)}h`,
        at: a.timestamp,
        since: a.timestamp,
        emailId: a.emailId,
        messageId: a.messageId,
        threadId: a.threadId,
      })
    }
  }

  // Applications: one row per job.
  const byJob = new Map<string, NewApplicationItem[]>()
  for (const app of apps ?? []) {
    const list = byJob.get(app.jobId) ?? []
    list.push(app)
    byJob.set(app.jobId, list)
  }
  for (const [jobId, list] of byJob) {
    const sorted = [...list].sort((a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime())
    const newest = sorted[0]
    const oldest = sorted[sorted.length - 1]
    const d = days(oldest.enteredAt, now)
    const urgency: Urgency = d >= 5 ? 'overdue' : d >= 2 ? 'today' : 'normal'
    const jobTitle = cleanJob(newest.jobTitle)
    const applicants: QueueApplicant[] = sorted.map((a) => ({
      associationId: a.associationId,
      candidateId: a.candidateId,
      name: a.candidateName,
      enteredAt: a.enteredAt,
      dismissKey: `application:${a.associationId}`,
    }))
    const urgencyLabel = d === 0 ? ago(newest.enteredAt, now) : `oldest ${d}d`
    if (sorted.length === 1) {
      out.push({
        id: `a-${newest.associationId}`,
        dismissKey: applicants[0].dismissKey,
        dismissKeys: [applicants[0].dismissKey],
        type: 'application',
        kind: 'application',
        label: 'New application',
        candidateName: newest.candidateName,
        candidateId: newest.candidateId,
        jobId,
        jobTitle,
        context: `${jobTitle} · applied ${ago(newest.enteredAt, now)}`,
        href: `/jobs/${jobId}?candidate=${newest.candidateId}`,
        urgency,
        urgencyLabel: d === 0 ? ago(newest.enteredAt, now) : `${d}d in review`,
        at: newest.enteredAt,
        since: newest.enteredAt,
        associationId: newest.associationId,
        applicants,
      })
    } else {
      out.push({
        id: `j-${jobId}`,
        dismissKey: `applications:${jobId}`,
        dismissKeys: applicants.map((a) => a.dismissKey),
        type: 'application',
        kind: 'applications',
        label: `${sorted.length} new applications`,
        candidateName: jobTitle,
        candidateId: null,
        jobId,
        jobTitle,
        context: `Waiting in Application review · newest ${ago(newest.enteredAt, now)}${d >= 1 ? ` · oldest ${d} ${plural(d, 'day', 'days')}` : ''}`,
        href: `/jobs/${jobId}?review=1`,
        urgency,
        urgencyLabel,
        at: newest.enteredAt,
        since: oldest.enteredAt,
        applicants,
      })
    }
  }

  return out
}

const time = (iso: string) => new Date(iso).getTime() || 0

/** Overdue first (oldest first), then everything else (newest first). */
export function arrangeQueue(items: QueueItem[]): { overdue: QueueItem[]; fresh: QueueItem[] } {
  const overdue = items.filter((q) => q.urgency === 'overdue').sort((a, b) => time(a.since) - time(b.since))
  const fresh = items.filter((q) => q.urgency !== 'overdue').sort((a, b) => time(b.at) - time(a.at))
  return { overdue, fresh }
}

/** The same order as one list (the phone's "Needs you"). */
export function orderedQueue(items: QueueItem[]): QueueItem[] {
  const { overdue, fresh } = arrangeQueue(items)
  return [...overdue, ...fresh]
}

/** How many of each chip, counting a job's applications by the people in it. */
export function queueCounts(items: QueueItem[]) {
  const c = { all: 0, scorecard: 0, decision: 0, reply: 0, application: 0 }
  for (const q of items) {
    const n = q.kind === 'applications' ? q.applicants?.length ?? 1 : 1
    c.all += n
    c[q.type] += n
  }
  return c
}

/** Hide rows (and applicants inside a job's row) already hidden by this person. */
export function withoutHidden(items: QueueItem[], hidden: Set<string>): QueueItem[] {
  return items.filter((q) => !hidden.has(q.dismissKey) && !hidden.has(q.id))
}

/** Applicants hidden one by one before grouping stay hidden inside their job's row. */
export function visibleApplications(apps: NewApplicationItem[] | undefined, hidden: Set<string>): NewApplicationItem[] {
  return (apps ?? []).filter((a) => !hidden.has(`application:${a.associationId}`) && !hidden.has(`a-${a.associationId}`))
}

// ─── The row's buttons (QueueRow) ───────────────────────────────────

export type QueueActionId =
  | 'approve'
  | 'decline'
  | 'scorecard'
  | 'advance'
  | 'reject'
  | 'reply'
  | 'no_reply'
  | 'review'

export interface QueueAction {
  id: QueueActionId
  label: string
  variant: 'primary' | 'secondary' | 'ghost'
}

/** The row's buttons, primary last (it sits at the right edge). */
export function rowActions(item: QueueItem): QueueAction[] {
  switch (item.kind) {
    case 'offer':
      return item.offerStepId
        ? [
            { id: 'decline', label: 'Decline', variant: 'secondary' },
            { id: 'approve', label: 'Approve', variant: 'primary' },
          ]
        : [{ id: 'decline', label: 'Open offer', variant: 'primary' }]
    case 'scorecard':
      if (item.isOwn === false) return [{ id: 'scorecard', label: 'Open scorecards', variant: 'secondary' }]
      return [{ id: 'scorecard', label: item.hasGioDraft ? 'Review draft' : 'Complete scorecard', variant: 'primary' }]
    case 'decision':
      return [
        { id: 'reject', label: 'Reject', variant: 'secondary' },
        { id: 'advance', label: 'Advance', variant: 'primary' },
      ]
    case 'reply':
      return [
        { id: 'no_reply', label: 'No reply needed', variant: 'ghost' },
        { id: 'reply', label: 'Reply', variant: 'primary' },
      ]
    case 'application':
      return [{ id: 'review', label: 'Review', variant: 'primary' }]
    case 'applications':
      return [{ id: 'review', label: 'Start review', variant: 'primary' }]
  }
}

// ─── Snooze (2026-11-14) ─────────────────────────────────────────────

/** A hidden row: for good (until null) or snoozed until a time. */
export interface HiddenEntry {
  key: string
  until: string | null
}

const dayKeyIn = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)

function wallToUtc(dayKey: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number)
  const naive = Date.UTC(y, m - 1, d, 0, minutes)
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(new Date(t))
    const get = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute')) - Math.floor(t / 60000) * 60000
  }
  let utc = naive - offsetAt(naive)
  utc = naive - offsetAt(utc)
  return new Date(utc)
}

function shiftDay(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 9:00 AM tomorrow, and 9:00 AM on the coming Monday (a week out when tomorrow is Monday), in `timeZone`. */
export function snoozeTimes(now: Date, timeZone: string): { tomorrow: Date; monday: Date } {
  const today = dayKeyIn(now, timeZone)
  const [y, m, d] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 Sunday … 6 Saturday
  let toMonday = (8 - weekday) % 7 || 7
  if (toMonday === 1) toMonday = 8
  return {
    tomorrow: wallToUtc(shiftDay(today, 1), 9 * 60, timeZone),
    monday: wallToUtc(shiftDay(today, toMonday), 9 * 60, timeZone),
  }
}

/** "tomorrow at 9:00 AM", "Mon at 9:00 AM", "Nov 23 at 9:00 AM" in `timeZone`. */
export function snoozeLabel(until: Date, timeZone: string, now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(until)
  const day = dayKeyIn(until, timeZone)
  const today = dayKeyIn(now, timeZone)
  if (day === today) return `today at ${time}`
  if (day === shiftDay(today, 1)) return `tomorrow at ${time}`
  const diff = (Date.parse(day) - Date.parse(today)) / 86_400_000
  const fmt = diff < 7
    ? { timeZone, weekday: 'short' as const }
    : { timeZone, month: 'short' as const, day: 'numeric' as const }
  return `${new Intl.DateTimeFormat('en-US', fmt).format(until)} at ${time}`
}

/**
 * Hidden keys now (for good, or snoozed until a time still ahead) and the snoozed ones
 * with their times. A snooze that has passed hides nothing: the row is back.
 */
export function hiddenState(entries: HiddenEntry[], now: number = Date.now()): {
  hidden: Set<string>
  snoozed: Map<string, string>
  nextWake: number | null
} {
  const hidden = new Set<string>()
  const snoozed = new Map<string, string>()
  let nextWake: number | null = null
  for (const e of entries) {
    if (!e.until) {
      hidden.add(e.key)
      continue
    }
    const t = Date.parse(e.until)
    if (t > now) {
      hidden.add(e.key)
      snoozed.set(e.key, e.until)
      nextWake = nextWake === null ? t : Math.min(nextWake, t)
    }
  }
  return { hidden, snoozed, nextWake }
}

/** The snoozed rows, each with when it comes back (a job's applications: the latest of theirs). */
export function snoozedRows(
  activities: PendingActivity[] | undefined,
  apps: NewApplicationItem[] | undefined,
  snoozed: Map<string, string>,
  hiddenForGood: Set<string>,
  now: number = Date.now(),
): (QueueItem & { snoozedUntil: string })[] {
  if (snoozed.size === 0) return []
  const snoozedApps = (apps ?? []).filter((a) => snoozed.has(`application:${a.associationId}`))
  return buildQueue(activities, snoozedApps, now)
    .filter((q) => q.dismissKeys.some((k) => snoozed.has(k)) && !hiddenForGood.has(q.dismissKey))
    .map((q) => {
      const times = q.dismissKeys.map((k) => snoozed.get(k)).filter((t): t is string => !!t)
      return { ...q, snoozedUntil: times.sort().at(-1)! }
    })
    .sort((a, b) => Date.parse(a.snoozedUntil) - Date.parse(b.snoozedUntil))
}
