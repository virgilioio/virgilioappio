import { employmentTypeKey } from '@/lib/employmentTypes'

/**
 * What an offer starts with (2026-11-18, 2026-11-19): from its job, the
 * department, client, employment type, work location and job title; from the
 * candidate's profile, their name, email, phone and where they live. Only
 * blank fields are filled, so nothing the recruiter chose or typed is
 * replaced; the recruiter can change any of them. Pure, for tests.
 */
export interface OfferJobFacts {
  title?: string | null
  department_id?: string | null
  organization_id?: string | null
  employment_type?: string | null
  work_mode?: string | null
}

export interface OfferCandidateFacts {
  candidate_name?: string | null
  email?: string | null
  /** extrapolated · unavailable · verified, or none: a guessed address never goes on an offer. */
  email_status?: string | null
  phone?: string | null
  location_city?: string | null
  location_state?: string | null
  location_country?: string | null
}

export interface PrefillField {
  field_name: string
  field_label?: string | null
  field_type: string
  field_config?: unknown
}

const WORK_LOCATIONS = new Set(['remote', 'hybrid', 'onsite'])

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** The field's name and label as words: "candidate s full legal name". */
const words = (field: PrefillField) =>
  `${field.field_name} ${field.field_label ?? ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const labelWords = (field: PrefillField) =>
  (field.field_label || field.field_name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// A field about someone other than the candidate is never filled from the candidate.
const SOMEONE_ELSE = /\b(manager|recruiter|hiring|supervisor|report|reports|reference|referee|emergency|client|company|employer|work|business|office|signer|sender)\b/

function isJobTitle(field: PrefillField) {
  if (field.field_type !== 'text') return false
  const label = labelWords(field)
  const name = field.field_name.toLowerCase()
  return name === 'job_title' || /^(job|position|role)( title)?$/.test(label) || label === 'title' || label === 'job title' || label === 'position title'
}

function isCandidateName(field: PrefillField) {
  if (field.field_type !== 'text') return false
  const w = words(field)
  if (SOMEONE_ELSE.test(w)) return false
  return /\b(full|legal) (legal )?name\b/.test(w) || /\bcandidate s? (full )?name\b/.test(w)
}

function isCandidateLocation(field: PrefillField) {
  if (field.field_type !== 'location') return false
  const w = words(field)
  if (SOMEONE_ELSE.test(w) || /\b(job|origin|birth|nationality|citizenship)\b/.test(w)) return false
  return /\b(candidate|personal|home|residence|resides|lives)\b/.test(w)
}

/**
 * A profile phone in the offer's own form: "+" then the country code and
 * number. A number with "+" keeps its own code; ten digits without one take
 * the field's default code; anything else can't be read safely and is left out.
 */
export function offerPhone(raw: unknown, defaultCode = '+1'): string | null {
  const text = clean(raw)
  if (!text) return null
  const digits = text.replace(/\D/g, '')
  if (text.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 10) {
    const code = /^\+\d{1,4}$/.test(defaultCode) ? defaultCode : '+1'
    return `${code}${digits}`
  }
  return null
}

function configOf(field: PrefillField): Record<string, unknown> {
  const c = field.field_config
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : {}
}

/** The value for one field, or null when neither the job nor the candidate says. */
export function prefillValueFor(field: PrefillField, job: OfferJobFacts | null | undefined, candidate?: OfferCandidateFacts | null): string | null {
  if (job) {
    switch (field.field_type) {
      case 'department':
        return job.department_id || null
      case 'client':
        return job.organization_id || null
      case 'employment_type':
        return employmentTypeKey(job.employment_type)
      case 'work_location': {
        const mode = (job.work_mode || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
        const key = mode === 'on_site' ? 'onsite' : mode
        return WORK_LOCATIONS.has(key) ? key : null
      }
    }
    if (isJobTitle(field)) return clean(job.title)
  }
  if (!candidate) return null
  if (field.field_type === 'email') {
    if (SOMEONE_ELSE.test(words(field))) return null
    const status = (candidate.email_status || '').toLowerCase()
    if (status && status !== 'verified') return null
    const email = clean(candidate.email)
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
  }
  if (field.field_type === 'phone') {
    if (SOMEONE_ELSE.test(words(field))) return null
    const code = configOf(field).defaultCountryCode
    return offerPhone(candidate.phone, typeof code === 'string' ? code : '+1')
  }
  if (isCandidateName(field)) return clean(candidate.candidate_name)
  if (isCandidateLocation(field)) {
    const place = { city: clean(candidate.location_city), state: clean(candidate.location_state), country: clean(candidate.location_country) }
    const wanted = configOf(field).fields
    const keys = Array.isArray(wanted) && wanted.length ? (wanted as string[]) : ['city', 'state', 'country']
    const value: Record<string, string> = {}
    for (const k of keys) {
      const v = place[k as keyof typeof place]
      if (v) value[k] = v
    }
    return Object.keys(value).length ? JSON.stringify(value) : null
  }
  return null
}

/** Kept for callers that only know the job: the job's value for a field of this type. */
export function jobValueFor(type: string, job: OfferJobFacts): string | null {
  return prefillValueFor({ field_name: '', field_type: type }, job, null)
}

/** The values to add: only blank fields the job or the candidate can fill. Empty when there's nothing to fill. */
export function offerPrefill(
  fields: PrefillField[],
  values: Record<string, unknown>,
  job: OfferJobFacts | null | undefined,
  candidate?: OfferCandidateFacts | null,
): Record<string, string> {
  const patch: Record<string, string> = {}
  if (!job && !candidate) return patch
  for (const field of fields) {
    if (!isBlank(values[field.field_name])) continue
    const value = prefillValueFor(field, job, candidate)
    if (value) patch[field.field_name] = value
  }
  return patch
}
