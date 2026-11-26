/**
 * Maps a job posting + parent job + tenant context into a schema.org JobPosting
 * object suitable for Google for Jobs indexing.
 *
 * Spec: https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */

import { googleEmploymentType } from '@/lib/employmentTypes'
import { countryNameOf, postingReach } from '@/lib/postingPlaces'

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

function plainText(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildJobPostingJsonLd(input: JobPostingJsonLdInput): Record<string, any> {
  const { posting, job, tenant, url } = input
  const d: any = posting.details || {}

  const datePosted = (posting.created_at || new Date().toISOString()).slice(0, 10)
  // Google drops a job once validThrough has passed, and asks for the property to be
  // left out when the job has no end date: only a deadline still ahead is sent.
  const deadline = typeof d.deadline === 'string' ? new Date(d.deadline) : null
  const validThrough = deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() > Date.now() ? deadline.toISOString() : null

  // Where the job is, read as the job feeds read it (2026-11-26): a remote job names
  // the countries candidates can be in and no place; any other names a real place.
  const reach = postingReach({
    location: d.location,
    additional: d.additional_locations,
    locationType: d.locationType || d.location_type,
  })

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
    ...(validThrough ? { validThrough } : {}),
    hiringOrganization,
    identifier: {
      '@type': 'PropertyValue',
      name: tenant.name,
      value: posting.id,
    },
    url,
    // The application form is on the posting page itself (2026-11-12), which Google ranks as direct apply.
    directApply: true,
  }

  const employmentType = googleEmploymentType(d.employmentType ?? d.employment_type)
  if (employmentType) obj.employmentType = employmentType

  if (reach.ok && reach.remote) {
    obj.jobLocationType = 'TELECOMMUTE'
    obj.applicantLocationRequirements = reach.countries.map((c) => ({ '@type': 'Country', name: countryNameOf(c) }))
  } else if (reach.ok) {
    const places = reach.places.map((p) => ({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(p.city ? { addressLocality: p.city } : {}),
        ...(p.region ? { addressRegion: p.region } : {}),
        addressCountry: p.country,
      },
    }))
    obj.jobLocation = places.length === 1 ? places[0] : places
  }

  const shown = job?.show_salary_public ?? d.show_salary_public ?? d.showSalary ?? false
  const showSalary = shown === true || shown === 'true'
  const min = job?.salary_min ?? d.salary_min ?? null
  const max = job?.salary_max ?? d.salary_max ?? null
  const currency = job?.currency ?? d.salary_currency ?? d.salaryCurrency ?? null
  // Postings store salary_period ('annually' | 'monthly' | 'hourly').
  const period = (d.salary_period || d.salaryPeriod || 'year').toString().toUpperCase()
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
  if (!d.employmentType && !d.employment_type) missing.push('Employment type')
  const reach = postingReach({ location: d.location, additional: d.additional_locations, locationType: d.locationType || d.location_type })
  if (!reach.ok) missing.push(reach.remote ? 'The countries candidates can be in' : 'A location with its country')
  const showSalary = (input.job?.show_salary_public ?? d.showSalary ?? false) === true
  if (showSalary) {
    const currency = input.job?.currency ?? d.salaryCurrency
    if (!currency) missing.push('Salary currency')
  }
  return missing
}
