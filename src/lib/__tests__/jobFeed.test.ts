import { describe, expect, it } from 'vitest'
import { feedEntries, feedSalary, postedDate, renderFeed, type FeedPosting } from '../../../supabase/functions/_shared/jobFeed.ts'
import { feedFilePath, feedFileUrl } from '../../../supabase/functions/_shared/jobFeedFile.ts'

const now = new Date('2026-11-26T12:00:00Z')
const body = `<h2>About the role</h2><p>${'Sell to schools and universities across the region. '.repeat(4)}</p>`
const post = (p: Partial<FeedPosting> & { details?: Record<string, unknown> }): FeedPosting => ({
  id: 'post-1', title: 'Account Executive', slug: 'account-executive', description: body, created_at: '2026-11-20T10:00:00Z', location: null,
  ...p, details: { employment_type: 'full_time', ...(p.details ?? {}) },
})
const build = (p: FeedPosting, board: 'talent' | 'whatjobs' | 'juju' | 'jooble' = 'talent') =>
  feedEntries(p, { board, jobUrl: 'https://app.gogio.io/careers/virgilio/' + p.slug, now })

describe('the job feed boards read', () => {
  it('lists an on-site job where it is', () => {
    const { entries, held } = build(post({ location: 'London, UK', details: { location: 'London, UK', location_type: 'hybrid' } }))
    expect(held).toBeNull()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ ref: 'post-1', city: 'London', state: 'England', country: 'United Kingdom', countryCode: 'GB', remote: false })
    expect(entries[0].url).toBe('https://app.gogio.io/careers/virgilio/account-executive?source=talent')
  })

  it('lists a remote job once per country candidates can be in', () => {
    const { entries } = build(post({ location: 'Remote', details: { location: 'Remote', additional_locations: ['Canada', 'United States'], location_type: 'remote' } }))
    expect(entries.map((e) => [e.ref, e.country, e.city, e.remote])).toEqual([
      ['post-1-ca', 'Canada', '', true],
      ['post-1-us', 'United States', '', true],
    ])
  })

  it('holds back a post no board could place, or with nothing to read', () => {
    expect(build(post({ location: 'Remote', details: { location: 'Remote', additional_locations: ['EMEA', 'LATAM', 'APAC'], location_type: 'remote' } })))
      .toEqual({ entries: [], held: 'no_country' })
    expect(build(post({ location: 'UAE', description: '', details: { location: 'UAE', additional_locations: ['Dubai'], location_type: 'onsite' } })))
      .toEqual({ entries: [], held: 'no_description' })
  })

  it('sends the salary only when the post shows it', () => {
    const range = { salary_min: '75000', salary_max: '95000', salary_currency: 'GBP', salary_period: 'annually' }
    expect(feedSalary({ ...range, show_salary_public: true })).toEqual({ currency: 'GBP', period: 'year', min: 75000, max: 95000 })
    expect(feedSalary({ ...range, show_salary_public: 'true', salary_period: 'monthly' })?.period).toBe('month')
    expect(feedSalary({ ...range, show_salary_public: false })).toBeNull()
    expect(feedSalary(range)).toBeNull()
    expect(feedSalary({ show_salary_public: true, salary_currency: 'USD' })).toBeNull()
  })

  it('keeps a still-open post looking current, never in the future', () => {
    expect(postedDate('2026-11-20T10:00:00Z', now)).toBe('2026-11-20T10:00:00.000Z')
    expect(postedDate('2026-09-10T10:00:00Z', now)).toBe('2026-11-09T10:00:00.000Z')
    expect(new Date(postedDate('2026-01-01T00:00:00Z', now)).getTime()).toBeLessThanOrEqual(now.getTime())
  })

  it('writes titles as they read, with the place and salary boards expect', () => {
    const { entries } = build(post({
      title: 'Strategy & Partnership Success Lead', location: 'London',
      details: { location: 'London', location_type: 'hybrid', show_salary_public: true, salary_min: '55000', salary_max: '85000', salary_currency: 'GBP', salary_period: 'annually' },
    }))
    const xml = renderFeed({ board: 'talent', company: 'Virgilio', entries, now, talentApply: (id) => ({ postUrl: `https://x.test/apply?posting_id=${id}`, questionsUrl: `https://x.test/q?posting_id=${id}` }) })
    expect(xml).toContain('<title><![CDATA[Strategy & Partnership Success Lead]]></title>')
    expect(xml).not.toContain('&amp;amp;')
    expect(xml).toContain('<city><![CDATA[London]]></city>')
    expect(xml).toContain('<country><![CDATA[United Kingdom]]></country>')
    expect(xml).toContain('<isremote>no</isremote>')
    expect(xml).toContain('<min>55000</min>')
    expect(xml).toContain('<max>85000</max>')
    expect(xml).toContain('talent-apply-posturl=https%3A%2F%2Fx.test%2Fapply%3Fposting_id%3Dpost-1')
    // Other boards get their own shapes, with no Talent.com apply data.
    const jooble = renderFeed({ board: 'jooble', company: 'Virgilio', entries, now })
    expect(jooble).not.toContain('talent-apply-data')
    expect(renderFeed({ board: 'whatjobs', company: 'Virgilio', entries, now })).toContain('<country><![CDATA[United Kingdom]]></country>')
    expect(renderFeed({ board: 'juju', company: 'Virgilio', entries, now })).toContain('<nation><![CDATA[United Kingdom]]></nation>')
  })
})

describe('feed files (2026-11-27)', () => {
  const T = '5BA7B145-F251-4B18-8900-724CB06028AB'
  it('keeps each board and workspace at one address in the public bucket', () => {
    expect(feedFilePath('talent', T)).toBe('talent/5ba7b145-f251-4b18-8900-724cb06028ab.xml')
    expect(feedFileUrl('https://etrxjxstjfcozdjumfsj.supabase.co/', 'jooble', T)).toBe(
      'https://etrxjxstjfcozdjumfsj.supabase.co/storage/v1/object/public/job-feeds/jooble/5ba7b145-f251-4b18-8900-724cb06028ab.xml',
    )
  })
  it('writes nothing outside a board and a workspace id', () => {
    expect(feedFilePath('../talent', T)).toBeNull()
    expect(feedFilePath('talent', '../../x')).toBeNull()
    expect(feedFileUrl('https://x.supabase.co', 'Talent', 'not-a-uuid')).toBeNull()
  })
})
