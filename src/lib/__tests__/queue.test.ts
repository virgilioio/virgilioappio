import { describe, expect, it } from 'vitest'
import { ago, arrangeQueue, buildQueue, hiddenState, orderedQueue, queueCounts, rowActions, snoozeLabel, snoozeTimes, snoozedRows, visibleApplications, withoutHidden } from '../queue'
import type { PendingActivity } from '@/hooks/usePendingActivities'
import type { NewApplicationItem } from '@/hooks/useNewApplicationsQueue'

const NOW = new Date('2026-11-14T18:00:00Z').getTime()
const hAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

const act = (p: Partial<PendingActivity> & Pick<PendingActivity, 'type' | 'id' | 'timestamp'>): PendingActivity => ({
  candidateId: 'c-' + p.id,
  candidateName: 'Person ' + p.id,
  jobId: 'job-1',
  jobTitle: 'Head of Marketing',
  ...p,
})

const app = (id: string, jobId: string, hoursAgo: number): NewApplicationItem => ({
  associationId: 'jca-' + id,
  candidateId: 'cand-' + id,
  candidateName: 'Applicant ' + id,
  jobId,
  jobTitle: jobId === 'job-2' ? 'Senior Product Designer' : 'Customer Success Manager',
  enteredAt: hAgo(hoursAgo),
  source: null,
})

describe('ago', () => {
  it('reads like a person', () => {
    expect(ago(hAgo(0), NOW)).toBe('just now')
    expect(ago(new Date(NOW - 12 * 60_000).toISOString(), NOW)).toBe('12 min ago')
    expect(ago(hAgo(3), NOW)).toBe('3h ago')
    expect(ago(hAgo(30), NOW)).toBe('yesterday')
    expect(ago(hAgo(100), NOW)).toBe('4 days ago')
  })
})

describe('buildQueue', () => {
  it('groups a job’s applications into one row and keeps a lone applicant named', () => {
    const q = buildQueue([], [app('a', 'job-2', 1), app('b', 'job-2', 5), app('c', 'job-2', 30), app('d', 'job-3', 2)], NOW)
    const group = q.find((r) => r.kind === 'applications')!
    expect(group.label).toBe('3 new applications')
    expect(group.candidateName).toBe('Senior Product Designer')
    expect(group.href).toBe('/jobs/job-2?review=1')
    expect(group.dismissKeys).toEqual(['application:jca-a', 'application:jca-b', 'application:jca-c'])
    expect(group.at).toBe(hAgo(1))
    expect(group.since).toBe(hAgo(30))
    const single = q.find((r) => r.kind === 'application')!
    expect(single.label).toBe('New application')
    expect(single.candidateName).toBe('Applicant d')
  })

  it('keeps the offer step and the Gio draft for the actions', () => {
    const q = buildQueue([
      act({ type: 'offer_approval', id: 'approval-1', timestamp: hAgo(30), offerStepId: 'step-1' }),
      act({ type: 'scorecard', id: 'b1', timestamp: hAgo(2), hasGioDraft: true, isOwnTask: true }),
    ], [], NOW)
    expect(q.find((r) => r.kind === 'offer')!.offerStepId).toBe('step-1')
    expect(q.find((r) => r.kind === 'offer')!.urgency).toBe('overdue')
    expect(q.find((r) => r.kind === 'scorecard')!.hasGioDraft).toBe(true)
  })

  it('names whose scorecard it is when it isn’t yours', () => {
    const q = buildQueue([act({ type: 'scorecard', id: 'b2', timestamp: hAgo(2), isOwnTask: false, interviewerName: 'Maya López' })], [], NOW)
    expect(q[0].isOwn).toBe(false)
    expect(q[0].context).toContain("Maya López's scorecard")
  })
})

describe('arrangeQueue', () => {
  const items = buildQueue([
    act({ type: 'scorecard', id: 'late2', timestamp: hAgo(50) }),
    act({ type: 'scorecard', id: 'late1', timestamp: hAgo(26) }),
    act({ type: 'email', id: 'e1', timestamp: hAgo(3) }),
    act({ type: 'decision', id: 'd1', timestamp: hAgo(10) }),
  ], [app('x', 'job-2', 1), app('y', 'job-2', 2)], NOW)

  it('puts overdue first, oldest first, then the rest newest first', () => {
    const { overdue, fresh } = arrangeQueue(items)
    expect(overdue.map((r) => r.id)).toEqual(['s-late2', 's-late1'])
    expect(fresh.map((r) => r.id)).toEqual(['j-job-2', 'e-e1', 'd-d1'])
    expect(orderedQueue(items).map((r) => r.id)).toEqual(['s-late2', 's-late1', 'j-job-2', 'e-e1', 'd-d1'])
  })

  it('counts applications by the people in them', () => {
    expect(queueCounts(items)).toEqual({ all: 6, scorecard: 2, decision: 1, reply: 1, application: 2 })
  })
})

describe('hidden rows', () => {
  it('leaves out hidden rows and hidden applicants, old keys too', () => {
    const items = buildQueue([act({ type: 'email', id: 'e9', timestamp: hAgo(1), messageId: 'm-9', threadId: 't-9' })], [], NOW)
    expect(items[0].dismissKey).toBe('reply:thread:t-9')
    expect(withoutHidden(items, new Set(['reply:thread:t-9']))).toEqual([])
    const apps = [app('a', 'job-2', 1), app('b', 'job-2', 2)]
    expect(visibleApplications(apps, new Set(['application:jca-a'])).map((a) => a.associationId)).toEqual(['jca-b'])
    expect(visibleApplications(apps, new Set(['a-jca-b'])).map((a) => a.associationId)).toEqual(['jca-a'])
  })
})

describe('rowActions', () => {
  const labels = (q: ReturnType<typeof buildQueue>[number]) => rowActions(q).map((a) => a.label)
  it('gives each row its real next step, primary last', () => {
    const q = buildQueue([
      act({ type: 'offer_approval', id: 'o', timestamp: hAgo(1), offerStepId: 'st' }),
      act({ type: 'scorecard', id: 'mine', timestamp: hAgo(1), isOwnTask: true }),
      act({ type: 'scorecard', id: 'draft', timestamp: hAgo(1), isOwnTask: true, hasGioDraft: true }),
      act({ type: 'scorecard', id: 'theirs', timestamp: hAgo(1), isOwnTask: false, interviewerName: 'Daniel Kim' }),
      act({ type: 'decision', id: 'd', timestamp: hAgo(1) }),
      act({ type: 'email', id: 'e', timestamp: hAgo(1) }),
    ], [app('one', 'job-3', 1), app('a', 'job-2', 1), app('b', 'job-2', 2)], NOW)
    const by = (id: string) => q.find((r) => r.id === id)!
    expect(labels(by('o-o'))).toEqual(['Decline', 'Approve'])
    expect(labels(by('s-mine'))).toEqual(['Complete scorecard'])
    expect(labels(by('s-draft'))).toEqual(['Review draft'])
    expect(labels(by('s-theirs'))).toEqual(['Open scorecards'])
    expect(labels(by('d-d'))).toEqual(['Reject', 'Advance'])
    expect(labels(by('e-e'))).toEqual(['No reply needed', 'Reply'])
    expect(labels(by('a-jca-one'))).toEqual(['Review'])
    expect(labels(by('j-job-2'))).toEqual(['Start review'])
  })
  it('an offer without its step only opens it', () => {
    const q = buildQueue([act({ type: 'offer_approval', id: 'o2', timestamp: hAgo(1) })], [], NOW)
    expect(labels(q[0])).toEqual(['Open offer'])
  })
})

describe('snooze', () => {
  const MX = 'America/Mexico_City'
  it('ends at 9:00 AM tomorrow and on the coming Monday, in the person\'s zone', () => {
    // Saturday Nov 14, 2026, 12:00 in Mexico City (18:00 UTC).
    const { tomorrow, monday } = snoozeTimes(new Date('2026-11-14T18:00:00Z'), MX)
    expect(tomorrow.toISOString()).toBe('2026-11-15T15:00:00.000Z')
    expect(monday.toISOString()).toBe('2026-11-16T15:00:00.000Z')
    // On a Sunday, "Monday" is a week out, never tomorrow twice.
    const sunday = snoozeTimes(new Date('2026-11-15T18:00:00Z'), MX)
    expect(sunday.tomorrow.toISOString()).toBe('2026-11-16T15:00:00.000Z')
    expect(sunday.monday.toISOString()).toBe('2026-11-23T15:00:00.000Z')
    // Late evening in Mexico City is already the next day in UTC.
    const late = snoozeTimes(new Date('2026-11-17T04:30:00Z'), MX) // Mon 22:30 local
    expect(late.tomorrow.toISOString()).toBe('2026-11-17T15:00:00.000Z')
    // Madrid's 9:00.
    expect(snoozeTimes(new Date('2026-11-14T18:00:00Z'), 'Europe/Madrid').tomorrow.toISOString()).toBe('2026-11-15T08:00:00.000Z')
  })

  it('says when it comes back', () => {
    const now = new Date('2026-11-14T18:00:00Z')
    expect(snoozeLabel(new Date('2026-11-15T15:00:00Z'), MX, now)).toBe('tomorrow at 9:00 AM')
    expect(snoozeLabel(new Date('2026-11-16T15:00:00Z'), MX, now)).toBe('Mon at 9:00 AM')
    expect(snoozeLabel(new Date('2026-11-23T15:00:00Z'), MX, now)).toBe('Nov 23 at 9:00 AM')
  })

  it('hides a snoozed row until its time, and a passed snooze hides nothing', () => {
    const now = Date.parse('2026-11-14T18:00:00Z')
    const s = hiddenState([
      { key: 'gone', until: null },
      { key: 'later', until: '2026-11-15T15:00:00Z' },
      { key: 'past', until: '2026-11-14T15:00:00Z' },
    ], now)
    expect([...s.hidden].sort()).toEqual(['gone', 'later'])
    expect([...s.snoozed.keys()]).toEqual(['later'])
    expect(s.nextWake).toBe(Date.parse('2026-11-15T15:00:00Z'))
  })

  it('lists snoozed rows with their time, a job\'s applications together', () => {
    const snoozed = new Map([
      ['application:jca-a', '2026-11-16T15:00:00Z'],
      ['application:jca-b', '2026-11-16T15:00:00Z'],
      ['decision:jca-c-d:', '2026-11-15T15:00:00Z'],
    ])
    const rows = snoozedRows(
      [act({ type: 'decision', id: 'd', timestamp: hAgo(1), associationId: 'jca-c-d' }), act({ type: 'email', id: 'e', timestamp: hAgo(1) })],
      [app('a', 'job-2', 1), app('b', 'job-2', 2), app('c', 'job-2', 3)],
      snoozed,
      new Set(),
      NOW,
    )
    expect(rows.map((r) => [r.id, r.snoozedUntil])).toEqual([
      ['d-d', '2026-11-15T15:00:00Z'],
      ['j-job-2', '2026-11-16T15:00:00Z'],
    ])
    expect(rows[1].label).toBe('2 new applications')
  })
})
