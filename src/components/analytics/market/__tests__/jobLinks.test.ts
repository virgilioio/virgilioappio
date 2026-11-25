import { describe, expect, it } from 'vitest'
import { buildJobIndex, hiredPeriods, linkValues, periodStart, withHires, type HireRow, type JobLink } from '../jobLinks'
import { applySelections, contextFor, emptyValueContext, valuesOf, type MarketRow, type MarketSelection, type ValueContext } from '../marketData'

const now = new Date(2026, 10, 5, 12) // 5 Nov 2026

const link = (p: Partial<JobLink> & Pick<JobLink, 'candidate_id' | 'job_id'>): JobLink => ({
  job_title: 'Head of Marketing', job_status: 'open', client_id: 'c-acme', client_name: 'Acme', status: 'active',
  stage_name: 'Application Review', stage_type: 'application_review', applied: true,
  added_at: '2026-11-02T10:00:00Z', rejection_reason: null, ...p,
})
const person = (id: string): MarketRow => ({
  id, country: 'Mexico', state: null, city: null, title: null, role_family: null, specialization: null, seniority: 'senior',
  company: null, years_experience: 5, skills: [], source: null, created_at: '2026-01-01T00:00:00Z', salary_month_base: null, in_pipeline: true,
})

// Ana: hired at Globex, in process at Acme. Ben: rejected at Acme (Skills mismatch). Cy: no jobs.
const links: JobLink[] = [
  link({ candidate_id: 'ana', job_id: 'j-acme', status: 'active', stage_name: 'Interview', stage_type: 'interview', applied: false }),
  link({ candidate_id: 'ana', job_id: 'j-globex', job_title: 'Head of Marketing', client_id: 'c-globex', client_name: 'Globex', status: 'hired', stage_name: 'Hired', stage_type: 'hired', added_at: '2025-03-01T00:00:00Z' }),
  link({ candidate_id: 'ben', job_id: 'j-acme', status: 'rejected', rejection_reason: 'Skills mismatch' }),
]
const rows = ['ana', 'ben', 'cy'].map(person)
const ctx: ValueContext = { ...emptyValueContext(), jobs: buildJobIndex(links), now }
const ids = (sel: MarketSelection[]) => applySelections(rows, sel, ctx).map(r => r.id)

describe('Intelligence by job and client', () => {
  it('names a repeated job title with its client', () => {
    expect(ctx.jobs.jobs.map(j => j.label).sort()).toEqual(['Head of Marketing · Acme', 'Head of Marketing · Globex'])
    expect(ctx.jobs.clients.map(c => `${c.label}:${c.people}`)).toEqual(['Acme:2', 'Globex:1'])
  })

  it('job filters hold for the same job', () => {
    expect(ids([{ dimension: 'mkt_client', value: 'Acme' }])).toEqual(['ana', 'ben'])
    expect(ids([{ dimension: 'mkt_job_state', value: 'Hired' }])).toEqual(['ana'])
    // Ana is hired, and in an Acme job, but not hired at Acme.
    expect(ids([{ dimension: 'mkt_client', value: 'Acme' }, { dimension: 'mkt_job_state', value: 'Hired' }])).toEqual([])
    // Values in one dimension are alternatives.
    expect(ids([{ dimension: 'mkt_job_state', value: 'Hired' }, { dimension: 'mkt_job_state', value: 'Rejected' }])).toEqual(['ana', 'ben'])
    // Person filters still combine with job filters.
    expect(ids([{ dimension: 'mkt_client', value: 'Acme' }, { dimension: 'mkt_seniority', value: 'Senior' }])).toEqual(['ana', 'ben'])
  })

  it('job values follow the job filters', () => {
    const sel: MarketSelection[] = [{ dimension: 'mkt_client', value: 'Acme' }]
    const scoped = contextFor(ctx, sel, 'mkt_stage')
    expect(valuesOf(rows[0], 'mkt_stage', scoped)).toEqual(['Interview'])
    expect(valuesOf(rows[0], 'mkt_stage', ctx)).toEqual(['Interview', 'Hired'])
    expect(valuesOf(rows[0], 'mkt_came_in', scoped)).toEqual(['Added by the team'])
    expect(valuesOf(rows[1], 'mkt_rejection', scoped)).toEqual(['Skills mismatch'])
    // A chart split by client ignores its own filter, so it keeps every bar.
    expect(valuesOf(rows[0], 'mkt_client', contextFor(ctx, sel, 'mkt_client'))).toEqual(['Acme', 'Globex'])
  })

  it('Job and Client count once per job; the rest once per person', () => {
    const two = [
      link({ candidate_id: 'dee', job_id: 'j1', job_title: 'Designer' }),
      link({ candidate_id: 'dee', job_id: 'j2', job_title: 'Writer' }),
    ]
    const c2: ValueContext = { ...emptyValueContext(), jobs: buildJobIndex(two), now }
    expect(valuesOf(person('dee'), 'mkt_client', c2)).toEqual(['Acme', 'Acme'])
    expect(valuesOf(person('dee'), 'mkt_job', c2)).toEqual(['Designer', 'Writer'])
    expect(valuesOf(person('dee'), 'mkt_came_in', c2)).toEqual(['Applied'])
  })

  it('added periods nest and follow the calendar', () => {
    expect(periodStart('This quarter', now)?.getMonth()).toBe(9)
    expect(linkValues(links[0], 'mkt_added', ctx.jobs, now)).toEqual(['This month', 'This quarter', 'This year', 'Last 12 months'])
    expect(linkValues(links[1], 'mkt_added', ctx.jobs, now)).toEqual([])
    expect(ids([{ dimension: 'mkt_added', value: 'This month' }])).toEqual(['ana', 'ben'])
  })

  // Hires (2026-11-25): the day the opening was filled and the salary on the offer.
  it('a hire carries its day and salary on its own job link', () => {
    const hire: HireRow = {
      candidate_id: 'ana', job_id: 'j-globex', opening_id: 'o1', req_id: 'REQ-1', hired_on: '2026-10-20',
      salary_amount: 40000, salary_currency: 'MXN', salary_period: 'monthly', salary_month_base: 40000,
    }
    const merged = withHires(links, [hire])
    expect(merged.find(l => l.job_id === 'j-globex')).toMatchObject({ hired_on: '2026-10-20', hired_salary_month_base: 40000 })
    expect(merged.find(l => l.candidate_id === 'ana' && l.job_id === 'j-acme')?.hired_on).toBeUndefined()
    expect(withHires(links, [{ ...hire, salary_month_base: null }]).find(l => l.job_id === 'j-globex')?.hired_salary_month_base).toBeNull()

    const c: ValueContext = { ...emptyValueContext(), jobs: buildJobIndex(merged), now }
    const hired = merged.find(l => l.job_id === 'j-globex')!
    // Added in March 2025, hired in October 2026: "Hired in" reads the hire day.
    expect(linkValues(hired, 'mkt_added', c.jobs, now)).toEqual([])
    expect(linkValues(hired, 'mkt_hired_in', c.jobs, now)).toEqual(['This quarter', 'This year', 'Last 12 months'])
    expect(linkValues(hired, 'mkt_hire_month', c.jobs, now)).toEqual(['Oct 2026'])
    expect(applySelections(rows, [{ dimension: 'mkt_hired_in', value: 'This year' }], c).map(r => r.id)).toEqual(['ana'])
    // Someone never hired has no hire period.
    expect(linkValues(merged[0], 'mkt_hired_in', c.jobs, now)).toEqual([])
  })

  it('hire periods follow the calendar', () => {
    expect(hiredPeriods('2025-06-30', now)).toEqual(['Last year'])
    expect(hiredPeriods('2025-12-15', now)).toEqual(['Last 12 months', 'Last year'])
    expect(hiredPeriods('2026-11-01', now)).toEqual(['This month', 'This quarter', 'This year', 'Last 12 months'])
    expect(hiredPeriods(null, now)).toEqual([])
  })
})
