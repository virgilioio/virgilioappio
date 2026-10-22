import { describe, expect, it } from 'vitest'
import { companyKey, matchContext, parseLocations, previewChecks, sameCompany, searchMatch, skillTiers } from '../findCriteria'

const criteria = {
  title_keywords: ['Customer Success Manager'],
  locations: ['Toronto, Canada'],
  seniorities: ['senior'],
  skills: ['Higher Education', 'Client Onboarding', 'EdTech SaaS', 'Renewals', 'Canvas or Moodle', 'Learning Analytics'],
  skill_priorities: {
    'Higher Education': 'must', 'Client Onboarding': 'must',
    'EdTech SaaS': 'nice', Renewals: 'nice', 'Canvas or Moodle': 'nice',
    'Learning Analytics': 'bonus',
  },
}
const ctx = matchContext(criteria)

describe('skillTiers', () => {
  it('reads the job-style priorities, and older keywords as nice-to-haves', () => {
    expect(ctx.tiers).toEqual({
      must: ['Higher Education', 'Client Onboarding'],
      nice: ['EdTech SaaS', 'Renewals', 'Canvas or Moodle'],
      extra: ['Learning Analytics'],
    })
    expect(skillTiers({ keywords: ['HubSpot', 'hubspot', 'Apollo'] })).toEqual({ must: [], nice: ['HubSpot', 'Apollo'], extra: [] })
  })
})

describe('searchMatch', () => {
  const strong = {
    title: 'Customer Success Manager',
    company: 'Brightpath Learning',
    country: 'Canada',
    city: 'Toronto',
    seniority: 'senior',
    text: 'Onboarded university clients to our EdTech SaaS platform. Higher education partnerships. Moodle admin. Renewals.',
  }

  it('scores a full match high and lists the skills it found by tier', () => {
    const m = searchMatch(strong, criteria, ctx)
    expect(m.score).toBeGreaterThanOrEqual(90)
    expect(m.missing_must).toEqual([])
    expect(m.matched_skills.map((s) => s.tier)).toEqual(['must', 'must', 'nice', 'nice', 'nice'])
  })

  it('caps like Gio Fit: one missing must-have at 79, two at 70', () => {
    const one = searchMatch({ ...strong, text: 'Onboarded clients to our EdTech SaaS platform. Moodle. Renewals.' }, criteria, ctx)
    expect(one.missing_must).toEqual(['Higher Education'])
    expect(one.score).toBeLessThanOrEqual(79)
    const two = searchMatch({ ...strong, text: 'EdTech SaaS. Renewals.' }, criteria, ctx)
    expect(two.missing_must.length).toBe(2)
    expect(two.score).toBeLessThanOrEqual(70)
  })

  it('matches word forms and either side of "or"', () => {
    const m = searchMatch({ ...strong, text: 'higher-education onboarding of clients; Canvas LMS' }, criteria, ctx)
    expect(m.matched_skills.map((s) => s.skill)).toEqual(['Higher Education', 'Client Onboarding', 'Canvas or Moodle'])
  })

  it('gives partial credit for a missing country and none for the wrong one', () => {
    const noCountry = searchMatch({ ...strong, country: null, city: null }, criteria, ctx).score
    const wrong = searchMatch({ ...strong, country: 'Mexico', city: null }, criteria, ctx).score
    const right = searchMatch(strong, criteria, ctx).score
    expect(right - noCountry).toBe(10)
    expect(right - wrong).toBe(20)
  })

  it('treats a search with no skills as full skill marks', () => {
    const c = { title_keywords: ['Customer Success Manager'] }
    expect(searchMatch({ title: 'Customer Success Manager' }, c, matchContext(c)).score).toBe(100)
  })
})

describe('previewChecks', () => {
  it('checks the title, credits Apollo for its filters, and leaves skills for later', () => {
    const c = previewChecks({ title: 'Customer Success Manager', company: 'Brightpath' }, criteria, ctx, { place: true, seniority: true })
    expect(c).toMatchObject({ title: 'yes', place: 'apollo', seniority: 'apollo', skills: 'later', company: null })
    expect(previewChecks({ title: 'Customer Success Lead' }, criteria, ctx, { place: false, seniority: false }))
      .toMatchObject({ title: 'close', place: null, seniority: null })
    expect(previewChecks({ title: 'Software Engineer' }, criteria, ctx, { place: true, seniority: true }).title).toBe('no')
  })
})

describe('companies and places', () => {
  it('matches company names without legal suffixes', () => {
    expect(companyKey('Salesforce, Inc.')).toBe('salesforce')
    expect(sameCompany('Salesforce', 'Salesforce, Inc.')).toBe(true)
    expect(sameCompany('Acme', 'Acme Payroll Group')).toBe(true)
    expect(sameCompany('Ac', 'Acme')).toBe(false)
  })

  it('reads accented country names and LATAM', () => {
    expect(parseLocations(['México']).countries).toEqual(['Mexico'])
    expect(parseLocations(['LATAM']).countries).toContain('Colombia')
    expect(parseLocations(['Remote'])).toEqual({ countries: [], cities: [] })
  })
})
