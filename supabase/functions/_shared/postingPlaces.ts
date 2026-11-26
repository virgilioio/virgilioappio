import { COUNTRY_NAMES } from './countryNames.ts'

/**
 * Where a job post is, for job boards and Google (2026-11-26). A post's
 * location is free text ("London", "Remote", "LATAM") with more places beside
 * it; a board can only place a job that names a country. This turns the text
 * into places (city, region, country) for an on-site or hybrid job, or into the
 * countries candidates can be in for a remote one, and says what's missing when
 * it can't. The feeds (generate-talent-feed), the Google markup
 * (jobPostingJsonLd) and the post editor's hint all read it, so they agree.
 * Pure: no lookups. Locations stay text; this only reads them.
 */

export interface PostingPlace {
  /** '' when the post names only a region or a country. */
  city: string
  /** State or province as written ('' when none). */
  region: string
  /** ISO two-letter code. */
  country: string
}

export type PlaceProblem =
  /** Nothing in the post names a country. */
  | { kind: 'no_country' }
  /** Only areas like "LATAM" or "EMEA": not countries. */
  | { kind: 'areas_only'; areas: string[] }
  /** A place that couldn't be read (kept out of the listing). */
  | { kind: 'unknown'; text: string }

export interface PostingReach {
  remote: boolean
  /** On-site and hybrid: where the job is. Remote: one entry per country (no city). */
  places: PostingPlace[]
  /** Every country the post reaches, in the order written. */
  countries: string[]
  problems: PlaceProblem[]
  /** False when boards and Google can't place it. */
  ok: boolean
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAMES).map(([code, name]) => [fold(name), code]),
)

const ALIASES: Record<string, string> = {
  usa: 'US', us: 'US', 'united states of america': 'US', america: 'US', eeuu: 'US', 'estados unidos': 'US',
  uk: 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB', 'reino unido': 'GB',
  uae: 'AE', emirates: 'AE', 'the emirates': 'AE',
  brasil: 'BR', espana: 'ES', 'the netherlands': 'NL', holland: 'NL', deutschland: 'DE', alemania: 'DE',
  'south korea': 'KR', korea: 'KR', russia: 'RU', czechia: 'CZ', 'ivory coast': 'CI', 'viet nam': 'VN',
  'republica dominicana': 'DO', 'the philippines': 'PH', filipinas: 'PH', turkiye: 'TR',
}

/** England and its neighbours are regions of GB, worth keeping on the listing. */
const GB_NATIONS = new Set(['england', 'scotland', 'wales', 'northern ireland'])

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}
const CA_PROVINCES: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
  QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
}
const STATE_BY_NAME: Record<string, [string, string]> = Object.fromEntries([
  ...Object.entries(US_STATES).map(([code, name]) => [fold(name), ['US', code]] as const),
  ...Object.entries(CA_PROVINCES).map(([code, name]) => [fold(name), ['CA', code]] as const),
])
// "Georgia" is a country first; "New York" and "Washington" read as cities when alone.
delete STATE_BY_NAME.georgia

/** Cities well enough known to stand without a country. Anything else needs one written. */
const CITIES: Record<string, [string, string]> = {
  london: ['GB', 'England'], manchester: ['GB', 'England'], birmingham: ['GB', 'England'], leeds: ['GB', 'England'],
  bristol: ['GB', 'England'], liverpool: ['GB', 'England'], edinburgh: ['GB', 'Scotland'], glasgow: ['GB', 'Scotland'],
  cardiff: ['GB', 'Wales'], belfast: ['GB', 'Northern Ireland'],
  'new york': ['US', 'NY'], 'new york city': ['US', 'NY'], nyc: ['US', 'NY'], 'los angeles': ['US', 'CA'],
  'san francisco': ['US', 'CA'], chicago: ['US', 'IL'], boston: ['US', 'MA'], seattle: ['US', 'WA'], austin: ['US', 'TX'],
  dallas: ['US', 'TX'], houston: ['US', 'TX'], miami: ['US', 'FL'], atlanta: ['US', 'GA'], denver: ['US', 'CO'],
  'washington dc': ['US', 'DC'], philadelphia: ['US', 'PA'], phoenix: ['US', 'AZ'], 'san diego': ['US', 'CA'],
  toronto: ['CA', 'ON'], vancouver: ['CA', 'BC'], montreal: ['CA', 'QC'], calgary: ['CA', 'AB'], ottawa: ['CA', 'ON'],
  bogota: ['CO', ''], medellin: ['CO', ''], cali: ['CO', ''], barranquilla: ['CO', ''], cartagena: ['CO', ''],
  'mexico city': ['MX', ''], cdmx: ['MX', ''], 'ciudad de mexico': ['MX', ''], guadalajara: ['MX', 'Jalisco'],
  monterrey: ['MX', 'Nuevo León'], zapopan: ['MX', 'Jalisco'], queretaro: ['MX', ''], tijuana: ['MX', ''],
  'buenos aires': ['AR', ''], santiago: ['CL', ''], lima: ['PE', ''], 'sao paulo': ['BR', ''], 'rio de janeiro': ['BR', ''],
  madrid: ['ES', ''], barcelona: ['ES', ''], paris: ['FR', ''], berlin: ['DE', ''], munich: ['DE', ''],
  amsterdam: ['NL', ''], dublin: ['IE', ''], lisbon: ['PT', ''], milan: ['IT', ''], rome: ['IT', ''], zurich: ['CH', ''],
  stockholm: ['SE', ''], dubai: ['AE', ''], 'abu dhabi': ['AE', ''], singapore: ['SG', ''], sydney: ['AU', ''],
  melbourne: ['AU', ''], manila: ['PH', ''], 'metro manila': ['PH', ''], tokyo: ['JP', ''], mumbai: ['IN', ''],
  bangalore: ['IN', ''], bengaluru: ['IN', ''], 'tel aviv': ['IL', ''], johannesburg: ['ZA', ''], 'cape town': ['ZA', ''],
}

/** Words that say how, not where. */
const NOT_A_PLACE = new Set([
  'remote', 'remoto', 'fully remote', '100% remote', 'work from home', 'wfh', 'hybrid', 'hibrido', 'onsite', 'on-site',
  'on site', 'presencial', 'anywhere', 'worldwide', 'global', 'international', 'any location', 'tbd', 'various',
])

/** Areas that hold many countries. Only the two-country one is spelled out. */
const AREAS: Record<string, string[] | null> = {
  latam: null, 'latin america': null, latinoamerica: null, 'south america': null, 'central america': null,
  emea: null, apac: null, europe: null, eu: null, asia: null, africa: null, 'middle east': null, mena: null,
  nordics: null, dach: null, benelux: null, americas: null, 'the americas': null,
  noram: ['US', 'CA'], 'north america': ['US', 'CA'], 'us & canada': ['US', 'CA'], 'us and canada': ['US', 'CA'],
  'usa & canada': ['US', 'CA'], 'usa and canada': ['US', 'CA'],
}

/** "Mexico", "México", "MX", "UK", "UAE" → an ISO code, or ''. */
export function countryCode(text: string | null | undefined): string {
  const raw = (text ?? '').trim()
  if (!raw) return ''
  if (/^[A-Za-z]{2}$/.test(raw) && raw === raw.toUpperCase() && COUNTRY_NAMES[raw]) return raw
  const f = fold(raw)
  return ALIASES[f] ?? BY_NAME[f] ?? ''
}

export const countryNameOf = (code: string) => COUNTRY_NAMES[code] ?? code

type Read =
  | { kind: 'place'; place: PostingPlace }
  | { kind: 'city'; city: string; region: string }
  | { kind: 'area'; text: string; countries: string[] | null }
  | { kind: 'skip' }
  | { kind: 'unknown'; text: string }

/** A state or province written as a name or a code that isn't also a country's ("NY", not "CA"). */
function stateOf(part: string): [string, string] | null {
  const byName = STATE_BY_NAME[fold(part)]
  if (byName) return byName
  if (/^[A-Z]{2}$/.test(part)) {
    const us = US_STATES[part] ? (['US', part] as [string, string]) : null
    const ca = CA_PROVINCES[part] ? (['CA', part] as [string, string]) : null
    // "CA" is California, Canada's code and more: left for the country to say.
    if (us && !ca && !COUNTRY_NAMES[part]) return us
    if (ca && !us && !COUNTRY_NAMES[part]) return ca
  }
  return null
}

function readOne(text: string): Read {
  const raw = text.replace(/\s+/g, ' ').trim()
  if (!raw) return { kind: 'skip' }
  const f = fold(raw.replace(/\((.*?)\)/g, ' $1 '))
  if (NOT_A_PLACE.has(f)) return { kind: 'skip' }
  if (f in AREAS) return { kind: 'area', text: raw, countries: AREAS[f] }

  const parts = raw.split(/[,·|/]| - /).map((p) => p.trim()).filter((p) => p && !NOT_A_PLACE.has(fold(p)))
  if (parts.length === 0) return { kind: 'skip' }

  const last = parts[parts.length - 1]
  // "CO" is Colombia and Colorado, "CA" Canada and California: a known city settles it, anything else must spell the country.
  if (parts.length >= 2 && /^[A-Z]{2}$/.test(last) && COUNTRY_NAMES[last] && (US_STATES[last] || CA_PROVINCES[last])) {
    const known = CITIES[fold(parts[0])]
    if (!known) return { kind: 'unknown', text: raw }
    return { kind: 'place', place: { city: parts[0], region: known[0] === last ? known[1] : last, country: known[0] } }
  }
  const country = countryCode(last)
  if (country) {
    const nation = GB_NATIONS.has(fold(last)) ? last : ''
    const rest = parts.slice(0, -1)
    if (rest.length === 0) return { kind: 'place', place: { city: '', region: nation, country } }
    const city = rest[0]
    const region = rest.length > 1 ? rest.slice(1).join(', ') : nation || (CITIES[fold(city)]?.[0] === country ? CITIES[fold(city)][1] : '')
    return { kind: 'place', place: { city, region, country } }
  }

  const state = stateOf(last)
  if (state) {
    const rest = parts.slice(0, -1)
    return { kind: 'place', place: { city: rest[0] ?? '', region: last, country: state[0] } }
  }

  const known = CITIES[fold(parts[0])]
  if (known) return { kind: 'place', place: { city: parts[0], region: parts[1] ?? known[1], country: known[0] } }

  // "City" or "City, Region" with no country anywhere in it.
  if (parts.length <= 2 && /^[\p{L}\s.'-]+$/u.test(parts.join(' '))) return { kind: 'city', city: parts[0], region: parts[1] ?? '' }
  return { kind: 'unknown', text: raw }
}

export interface PostingPlaceInput {
  location?: string | null
  additional?: unknown
  /** remote · hybrid · onsite, as the post stores it. */
  locationType?: string | null
}

/** Where boards and Google list a post, or what's missing. */
export function postingReach(input: PostingPlaceInput): PostingReach {
  const texts = [input.location, ...(Array.isArray(input.additional) ? input.additional : [])]
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
  const saysRemote = texts.some((t) => /\b(remote|remoto|work from home|wfh)\b/i.test(t))
  const type = (input.locationType ?? '').toLowerCase()
  const remote = type ? type.includes('remote') : saysRemote

  const reads = texts.map(readOne)
  const places: PostingPlace[] = []
  const problems: PlaceProblem[] = []
  const areas: string[] = []
  const add = (p: PostingPlace) => {
    if (!places.some((x) => x.country === p.country && fold(x.city) === fold(p.city) && fold(x.region) === fold(p.region))) places.push(p)
  }
  for (const r of reads) {
    if (r.kind === 'place') add(r.place)
    else if (r.kind === 'area') {
      if (r.countries) r.countries.forEach((country) => add({ city: '', region: '', country }))
      else areas.push(r.text)
    }
  }
  // A bare city takes the post's one country ("UAE" beside "Dubai").
  const named = [...new Set(places.map((p) => p.country))]
  for (const r of reads) {
    if (r.kind === 'city') {
      if (named.length === 1) add({ city: r.city, region: r.region, country: named[0] })
      else problems.push({ kind: 'unknown', text: r.region ? `${r.city}, ${r.region}` : r.city })
    } else if (r.kind === 'unknown') problems.push({ kind: 'unknown', text: r.text })
  }

  const countries = [...new Set(places.map((p) => p.country))]
  let listed: PostingPlace[]
  if (remote) {
    listed = countries.map((country) => ({ city: '', region: '', country }))
  } else {
    // A country on its own steps aside for its cities.
    listed = places.filter((p) => p.city || p.region || !places.some((x) => x.country === p.country && (x.city || x.region)))
  }

  if (listed.length === 0) problems.unshift(areas.length ? { kind: 'areas_only', areas } : { kind: 'no_country' })
  return { remote, places: listed, countries, problems, ok: listed.length > 0 }
}

/** "London, England, United Kingdom", "Canada". */
export function placeLabel(p: PostingPlace): string {
  return [p.city, p.region, countryNameOf(p.country)].filter(Boolean).join(', ')
}

const listOf = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/** One sentence for the post editor: where it's listed, or what to add. */
export function reachSentence(reach: PostingReach): { ok: boolean; text: string } {
  if (reach.ok) {
    const where = reach.remote
      ? `as remote, open to candidates in ${listOf(reach.countries.map(countryNameOf))}`
      : `in ${listOf(reach.places.map(placeLabel))}`
    const skipped = reach.problems.filter((p): p is Extract<PlaceProblem, { kind: 'unknown' }> => p.kind === 'unknown').map((p) => p.text)
    return {
      ok: true,
      text: `Job boards and Google list it ${where}.${skipped.length ? ` ${listOf(skipped.map((s) => `“${s}”`))} ${skipped.length === 1 ? 'needs' : 'need'} a country to be listed too.` : ''}`,
    }
  }
  const first = reach.problems[0]
  if (first?.kind === 'areas_only') {
    return {
      ok: false,
      text: `${listOf(first.areas)} ${first.areas.length === 1 ? 'isn’t a country' : 'aren’t countries'}, so job boards and Google can’t place this post. Add the countries ${reach.remote ? 'candidates can be in' : 'it’s in'}.`,
    }
  }
  return {
    ok: false,
    text: reach.remote
      ? 'Job boards and Google need a country, even for a remote job. Add the countries candidates can be in.'
      : 'Job boards and Google need a country. Write the location as “City, Country”.',
  }
}
