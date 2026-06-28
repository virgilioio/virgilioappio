/**
 * Maps a job posting + parent job + tenant context into a schema.org JobPosting
 * object suitable for Google for Jobs indexing.
 *
 * Spec: https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */

export interface JobPostingJsonLdInput {
  posting: {
    id: string
    title: string
    description: string | null
    created_at?: string
    updated_at?: string
    details?: any
  }
  job: {
    salary_min?: number | null
    salary_max?: number | null
    currency?: string | null
    show_salary_public?: boolean | null
  } | null
  tenant: {
    name: string
    logoUrl?: string | null
    websiteUrl?: string | null
  }
  url: string
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  full_time: 'FULL_TIME',
  'full-time': 'FULL_TIME',
  fulltime: 'FULL_TIME',
  part_time: 'PART_TIME',
  'part-time': 'PART_TIME',
  contract: 'CONTRACTOR',
  contractor: 'CONTRACTOR',
  freelance: 'CONTRACTOR',
  internship: 'INTERN',
  intern: 'INTERN',
  temporary: 'TEMPORARY',
  temp: 'TEMPORARY',
  volunteer: 'VOLUNTEER',
  other: 'OTHER',
}

function mapEmploymentType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return EMPLOYMENT_TYPE_MAP[value.toLowerCase().trim()]
}

function plainText(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildJobPostingJsonLd(input: JobPostingJsonLdInput): Record<string, any> {
  const { posting, job, tenant, url } = input
  const d: any = posting.details || {}

  const datePosted = (posting.created_at || new Date().toISOString()).slice(0, 10)
  const validThrough =
    typeof d.valid_through === 'string'
      ? d.valid_through
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const locationType: string | undefined = d.locationType || d.location_type
  const isRemote = typeof locationType === 'string' && locationType.toLowerCase().includes('remote')
  const locationString: string | undefined = d.location || undefined

  const hiringOrganization: Record<string, any> = {
    '@type': 'Organization',
    name: tenant.name,
  }
  if (tenant.logoUrl) hiringOrganization.logo = tenant.logoUrl
  if (tenant.websiteUrl) hiringOrganization.sameAs = tenant.websiteUrl

  const obj: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: posting.title,
    description: posting.description || plainText(posting.title),
    datePosted,
    validThrough,
    hiringOrganization,
    identifier: {
      '@type': 'PropertyValue',
      name: tenant.name,
      value: posting.id,
    },
    url,
    directApply: false,
  }

  const employmentType = mapEmploymentType(d.employmentType ?? d.employment_type)
  if (employmentType) obj.employmentType = employmentType

  if (isRemote) {
    obj.jobLocationType = 'TELECOMMUTE'
    // Required for remote roles per Google spec.
    const countries: string[] = Array.isArray(d.applicant_countries) && d.applicant_countries.length
      ? d.applicant_countries
      : ['Worldwide']
    obj.applicantLocationRequirements = countries.map((c) => ({
      '@type': 'Country',
      name: c,
    }))
  }

  if (locationString) {
    // Best-effort address parsing from a free-text string like "Berlin, Germany".
    const parts = locationString.split(',').map((s) => s.trim()).filter(Boolean)
    const addressLocality = parts[0]
    const addressCountry = parts.length > 1 ? parts[parts.length - 1] : undefined
    const addressRegion = parts.length > 2 ? parts.slice(1, -1).join(', ') : undefined
    obj.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(addressLocality ? { addressLocality } : {}),
        ...(addressRegion ? { addressRegion } : {}),
        ...(addressCountry ? { addressCountry } : {}),
      },
    }
  }

  const showSalary =
    (job?.show_salary_public ?? d.showSalary ?? false) === true
  const min = job?.salary_min ?? d.salary_min ?? null
  const max = job?.salary_max ?? d.salary_max ?? null
  const currency = job?.currency ?? d.salaryCurrency ?? null
  const period = (d.salaryPeriod || 'year').toString().toUpperCase()
  const unitText =
    period.includes('HOUR') ? 'HOUR'
    : period.includes('DAY') ? 'DAY'
    : period.includes('WEEK') ? 'WEEK'
    : period.includes('MONTH') ? 'MONTH'
    : 'YEAR'

  if (showSalary && currency && (min || max)) {
    obj.baseSalary = {
      '@type': 'MonetaryAmount',
      currency,
      value: {
        '@type': 'QuantitativeValue',
        ...(min ? { minValue: Number(min) } : {}),
        ...(max ? { maxValue: Number(max) } : {}),
        unitText,
      },
    }
  }

  return obj
}

/**
 * Returns true when the posting has the minimum fields Google requires.
 * Useful for surfacing a non-blocking warning in the wizard.
 */
export function jobPostingJsonLdMissingFields(
  input: Pick<JobPostingJsonLdInput, 'posting' | 'job'>
): string[] {
  const missing: string[] = []
  const d: any = input.posting.details || {}
  const locationType: string | undefined = d.locationType || d.location_type
  const isRemote = typeof locationType === 'string' && locationType.toLowerCase().includes('remote')
  if (!d.employmentType && !d.employment_type) missing.push('Employment type')
  if (!isRemote && !d.location) missing.push('Location or remote flag')
  const showSalary = (input.job?.show_salary_public ?? d.showSalary ?? false) === true
  if (showSalary) {
    const currency = input.job?.currency ?? d.salaryCurrency
    if (!currency) missing.push('Salary currency')
  }
  return missing
}
