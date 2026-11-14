import { describe, expect, it } from 'vitest'
import { ago, arrangeQueue, buildQueue, orderedQueue, queueCounts, visibleApplications, withoutHidden } from '../queue'
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
    const items = buildQueue([act({ type: 'email', id: 'e9', timestamp: hAgo(1), messageId: 'm-9' })], [], NOW)
    expect(withoutHidden(items, new Set(['reply:m-9']))).toEqual([])
    const apps = [app('a', 'job-2', 1), app('b', 'job-2', 2)]
    expect(visibleApplications(apps, new Set(['application:jca-a'])).map((a) => a.associationId)).toEqual(['jca-b'])
    expect(visibleApplications(apps, new Set(['a-jca-b'])).map((a) => a.associationId)).toEqual(['jca-a'])
  })
})
