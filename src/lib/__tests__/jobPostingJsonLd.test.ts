import { describe, expect, it } from 'vitest'
import { buildJobPostingJsonLd, jobPostingJsonLdMissingFields } from '../jobPostingJsonLd'

const ld = (details: Record<string, unknown>, job: Record<string, unknown> | null = null) =>
  buildJobPostingJsonLd({
    posting: { id: 'p1', title: 'Account Executive', description: '<p>Sell.</p>', created_at: '2026-11-20T10:00:00Z', details },
    job: job as never,
    tenant: { name: 'Virgilio' },
    url: 'https://app.gogio.io/careers/virgilio/account-executive',
  })

describe('the job markup Google reads', () => {
  it('gives an on-site or hybrid job a real place', () => {
    expect(ld({ location: 'London, UK', location_type: 'hybrid' }).jobLocation).toEqual({
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: 'London', addressRegion: 'England', addressCountry: 'GB' },
    })
    const two = ld({ location: 'Toronto, ON', additional_locations: ['Austin, TX'], location_type: 'onsite' }).jobLocation
    expect(two.map((p: { address: { addressCountry: string } }) => p.address.addressCountry)).toEqual(['CA', 'US'])
    expect(ld({ location: 'London', location_type: 'hybrid' }).jobLocationType).toBeUndefined()
  })

  it('gives a remote job the countries candidates can be in, and no made-up place', () => {
    const remote = ld({ location: 'Remote', additional_locations: ['Canada', 'United States'], location_type: 'remote' })
    expect(remote.jobLocationType).toBe('TELECOMMUTE')
    expect(remote.applicantLocationRequirements).toEqual([{ '@type': 'Country', name: 'Canada' }, { '@type': 'Country', name: 'United States' }])
    expect(remote.jobLocation).toBeUndefined()
  })

  it('claims no location when the post names no country', () => {
    const vague = ld({ location: 'Remote', additional_locations: ['EMEA', 'LATAM'], location_type: 'remote' })
    expect(vague.jobLocationType).toBeUndefined()
    expect(vague.applicantLocationRequirements).toBeUndefined()
    expect(vague.jobLocation).toBeUndefined()
    expect(JSON.stringify(vague)).not.toContain('Worldwide')
    expect(jobPostingJsonLdMissingFields({ posting: { id: 'p', title: 't', description: '', details: { employment_type: 'full_time', location: 'Remote', location_type: 'remote' } }, job: null }))
      .toEqual(['The countries candidates can be in'])
  })

  it('sends an end date only for a deadline still ahead', () => {
    expect(ld({ location: 'London, UK', deadline: '2020-01-01T00:00:00.000Z' }).validThrough).toBeUndefined()
    expect(ld({ location: 'London, UK' }).validThrough).toBeUndefined()
    expect(ld({ location: 'London, UK', deadline: '2999-01-01T00:00:00.000Z' }).validThrough).toBe('2999-01-01T00:00:00.000Z')
  })

  it('shows the salary only when the post does', () => {
    const range = { location: 'London, UK', salary_min: '75000', salary_max: '95000', salary_currency: 'GBP', salary_period: 'annually' }
    expect(ld({ ...range, show_salary_public: true }).baseSalary).toEqual({
      '@type': 'MonetaryAmount', currency: 'GBP', value: { '@type': 'QuantitativeValue', minValue: 75000, maxValue: 95000, unitText: 'YEAR' },
    })
    expect(ld(range).baseSalary).toBeUndefined()
    expect(ld({ ...range, show_salary_public: true }, { show_salary_public: false, salary_min: 1, salary_max: 2, currency: 'GBP' }).baseSalary).toBeUndefined()
  })
})
