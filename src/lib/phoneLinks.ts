/**
 * Home's "Needs you" rows link to a job page with the candidate in the query
 * (`/jobs/J?candidate=C&tab=offer`), which on a computer opens the profile over the
 * pipeline. A phone shows the job as its own glance screen, so on a phone the row goes
 * straight to the in-job profile, keeping the tab it asked for.
 */
export function phoneQueueHref(href: string | undefined, candidateId: string): string {
  if (!href) return `/candidates/${candidateId}`
  const [path, qs = ''] = href.split('?')
  const job = path.match(/^\/jobs\/([^/]+)\/?$/)
  const params = new URLSearchParams(qs)
  const candidate = params.get('candidate')
  if (!job || !candidate) return href
  const tab = params.get('open') === 'scorecard' ? 'scorecards' : params.get('tab')
  return `/jobs/${job[1]}/candidates/${candidate}${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`
}
