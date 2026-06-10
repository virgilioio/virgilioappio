/**
 * Canonical public posting URL helper.
 *
 * - Virgilio internal org → /virgilio-careers/:postingSlug
 * - Any other tenant      → /careers/:companySlug/:postingSlug
 * - Fallback (no slug yet) → /p/:postingSlug (legacy, still routes)
 */

export const VIRGILIO_INTERNAL_ORG_ID = '4b8e739f-2b15-487e-8d31-0a2ce765a8ef'

export interface BuildPostingPathArgs {
  postingSlug: string
  /** jobs.organization_id of the parent job. */
  organizationId?: string | null
  /** careers_page_settings.company_slug for the tenant. */
  companySlug?: string | null
}

export function buildPostingPath({
  postingSlug,
  organizationId,
  companySlug,
}: BuildPostingPathArgs): string {
  if (organizationId === VIRGILIO_INTERNAL_ORG_ID) {
    return `/virgilio-careers/${postingSlug}`
  }
  if (companySlug) {
    return `/careers/${companySlug}/${postingSlug}`
  }
  // Legacy fallback — kept until careers settings are guaranteed for every tenant.
  return `/p/${postingSlug}`
}

export function buildPostingUrl(args: BuildPostingPathArgs): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${buildPostingPath(args)}`
}
