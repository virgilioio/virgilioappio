export type SalesPerson = { id: string; name?: string | null; email?: string | null }
export type SalesTeam = { sales?: SalesPerson[]; es?: SalesPerson[] } | null | undefined

/** Mirrors the attribution part of the database publish gate (job_setup_checks). */
export function missingForPublish(
  job: { sales_deal_id?: string | null; sales_team?: SalesTeam } | null | undefined,
  assignments: Array<{ role: string; deleted_at?: string | null }>,
): string[] {
  const live = assignments.filter((a) => !a.deleted_at)
  const missing: string[] = []
  if (!live.some((a) => a.role === 'sourcer')) missing.push('a Sourcer')
  if (!live.some((a) => a.role === 'recruiter')) missing.push('a Recruiter')
  if (job?.sales_deal_id) {
    if (!(job.sales_team?.sales?.length)) missing.push('Sales')
    if (!(job.sales_team?.es?.length)) missing.push('an Engagement Specialist')
  }
  return missing
}

export const isPublishGateError = (message?: string | null) =>
  !!message &&
  (/^Assign .+ before publishing\.?$/i.test(message.trim()) ||
    /^Complete the setup before publishing/i.test(message.trim()))
