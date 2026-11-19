import { employmentTypeKey } from '@/lib/employmentTypes'

/**
 * What an offer starts with from its job (2026-11-18): the job's department,
 * client, employment type and work location fill the offer form's fields of
 * those kinds. Only blank fields are filled, so nothing the recruiter chose or
 * typed is replaced; the recruiter can change any of them. Pure, for tests.
 */
export interface OfferJobFacts {
  department_id?: string | null
  organization_id?: string | null
  employment_type?: string | null
  work_mode?: string | null
}

const WORK_LOCATIONS = new Set(['remote', 'hybrid', 'onsite'])

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

/** The job's value for a field of this type, or null when the job has none. */
export function jobValueFor(type: string, job: OfferJobFacts): string | null {
  switch (type) {
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
    default:
      return null
  }
}

/** The values to add: only blank fields of a kind the job knows. Empty when there's nothing to fill. */
export function offerPrefill(
  fields: { field_name: string; field_type: string }[],
  values: Record<string, unknown>,
  job: OfferJobFacts | null | undefined,
): Record<string, string> {
  const patch: Record<string, string> = {}
  if (!job) return patch
  for (const field of fields) {
    if (!isBlank(values[field.field_name])) continue
    const value = jobValueFor(field.field_type, job)
    if (value) patch[field.field_name] = value
  }
  return patch
}
