import { describe, expect, it } from 'vitest'
import { COUNTRIES } from '@/constants/countries'
import { COUNTRY_NAMES } from '../../../supabase/functions/_shared/countryNames.ts'
import { countryCode, placeLabel, postingReach, reachSentence } from '../postingPlaces'

const reach = (location: string, additional: string[] = [], locationType?: string) => postingReach({ location, additional, locationType })
const labels = (r: ReturnType<typeof postingReach>) => r.places.map(placeLabel)

describe('where a job post is, for boards and Google', () => {
  it('shares its country list with the app', () => {
    const app = Object.fromEntries(COUNTRIES.filter((c) => c.value !== 'OTHER').map((c) => [c.value, c.label]))
    expect(COUNTRY_NAMES).toEqual(app)
  })

  it('reads countries however they are written', () => {
    expect(['Mexico', 'México', 'MX', 'UK', 'U.K.', 'UAE', 'USA', 'United States', 'Perú', 'Brasil'].map(countryCode))
      .toEqual(['MX', 'MX', 'MX', 'GB', 'GB', 'AE', 'US', 'US', 'PE', 'BR'])
    expect(countryCode('Remote')).toBe('')
    expect(countryCode('London')).toBe('')
  })

  it('places an on-site or hybrid job', () => {
    expect(labels(reach('London, UK', [], 'hybrid'))).toEqual(['London, England, United Kingdom'])
    expect(labels(reach('London', [], 'hybrid'))).toEqual(['London, England, United Kingdom'])
    expect(labels(reach('New York, NY', [], 'onsite'))).toEqual(['New York, NY, United States'])
    expect(labels(reach('Guadalajara, Jalisco, Mexico', [], 'onsite'))).toEqual(['Guadalajara, Jalisco, Mexico'])
    expect(labels(reach('Toronto, ON', ['Austin, TX'], 'onsite'))).toEqual(['Toronto, ON, Canada', 'Austin, TX, United States'])
    // A bare city takes the post's one country, and the country steps aside for it.
    expect(labels(reach('UAE', ['Dubai'], 'onsite'))).toEqual(['Dubai, United Arab Emirates'])
    expect(labels(reach('Colombia', [], 'onsite'))).toEqual(['Colombia'])
  })

  it('lists a remote job by the countries candidates can be in', () => {
    const r = reach('Remote', ['Canada', 'United States'], 'remote')
    expect(r).toMatchObject({ remote: true, ok: true, countries: ['CA', 'US'] })
    expect(r.places).toEqual([{ city: '', region: '', country: 'CA' }, { city: '', region: '', country: 'US' }])
    expect(reach('LATAM', ['México', 'Argentina', 'Perú', 'Chile', 'Brazil'], 'remote').countries).toEqual(['MX', 'AR', 'PE', 'CL', 'BR'])
    expect(reach('Canada', ['United States'], 'remote').countries).toEqual(['CA', 'US'])
    expect(reach('Remote', ['Colombia'], 'remote').countries).toEqual(['CO'])
    expect(reach('Remote', ['North America'], 'remote').countries).toEqual(['US', 'CA'])
    // A city on a remote post still says only which country.
    expect(reach('Remote', ['Bogotá, Colombia'], 'remote').places).toEqual([{ city: '', region: '', country: 'CO' }])
  })

  it('says what is missing when nothing names a country', () => {
    const areas = reach('Remote', ['EMEA', 'LATAM', 'APAC'], 'remote')
    expect(areas.ok).toBe(false)
    expect(areas.problems[0]).toEqual({ kind: 'areas_only', areas: ['EMEA', 'LATAM', 'APAC'] })
    expect(reachSentence(areas).text).toBe('EMEA, LATAM and APAC aren’t countries, so job boards and Google can’t place this post. Add the countries candidates can be in.')
    expect(reach('Remote', [], 'remote')).toMatchObject({ ok: false, problems: [{ kind: 'no_country' }] })
    expect(reach('', [], 'onsite').ok).toBe(false)
    // An unknown town alone can't be placed; beside a readable place it's named in the hint.
    expect(reach('Springfield', [], 'onsite').ok).toBe(false)
    const mixed = reach('London, UK', ['Springfield', 'Paris, TX'], 'onsite')
    expect(labels(mixed)).toEqual(['London, England, United Kingdom', 'Paris, TX, United States'])
    expect(reachSentence(mixed).text).toContain('“Springfield” needs a country to be listed too.')
  })

  it('never mistakes a code that could be two things', () => {
    // "CA" is California and Canada; "CO" Colorado and Colombia: a known city settles it.
    expect(labels(reach('Vancouver, CA', [], 'onsite'))).toEqual(['Vancouver, BC, Canada'])
    expect(labels(reach('Bogotá, CO', [], 'onsite'))).toEqual(['Bogotá, Colombia'])
    expect(labels(reach('Denver, CO', [], 'onsite'))).toEqual(['Denver, CO, United States'])
    expect(labels(reach('San Francisco, CA', [], 'onsite'))).toEqual(['San Francisco, CA, United States'])
    // An unknown town with such a code isn't guessed.
    expect(reach('Boulder, CO', [], 'onsite').ok).toBe(false)
    expect(labels(reach('Boulder, Colorado', [], 'onsite'))).toEqual(['Boulder, Colorado, United States'])
  })

  it('words the listing for the editor', () => {
    expect(reachSentence(reach('London, UK', [], 'hybrid')).text).toBe('Job boards and Google list it in London, England, United Kingdom.')
    expect(reachSentence(reach('Remote', ['Canada', 'United States'], 'remote')).text)
      .toBe('Job boards and Google list it as remote, open to candidates in Canada and United States.')
    expect(reachSentence(reach('Remote', [], 'remote')).ok).toBe(false)
  })
})
