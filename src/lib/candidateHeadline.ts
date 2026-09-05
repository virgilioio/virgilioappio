/**
 * Shared derivation of a candidate's "last job title @ latest employer" headline.
 * The parser writes into several places depending on the source (resume parse,
 * Apollo, CSV, LinkedIn), so we read them all in priority order.
 */

/** "Account Executive, Account Executive" -> "Account Executive" */
export function dedupeTitle(value?: string | null): string | null {
  if (!value) return null
  const parts = value
    .split(/\s*[,|/]\s*|\s+·\s+/)
    .map(p => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return value.trim() || null
  const seen: string[] = []
  for (const p of parts) {
    if (!seen.some(s => s.toLowerCase() === p.toLowerCase())) seen.push(p)
  }
  return seen.join(', ')
}

/** Apollo bios look like "Account Executive at Spireon, Inc." */
export function parseBioHeadline(bio?: string | null): { title: string | null; company: string | null } {
  if (!bio) return { title: null, company: null }
  const line = bio.split('\n')[0].trim()
  const m = line.match(/^(.{2,80}?)\s+(?:at|@)\s+(.{2,80})$/i)
  if (!m) return { title: null, company: null }
  return { title: m[1].trim(), company: m[2].replace(/[.\s]+$/, '').trim() }
}

export interface CandidateHeadlineSource {
  current_job_title?: string | null
  role_current?: string | null
  company_current?: string | null
  bio?: string | null
}

export interface WorkExperienceLike {
  job_title?: string | null
  company_name?: string | null
}

export function resolveCandidateHeadline(
  candidate: CandidateHeadlineSource | null | undefined,
  latestExperience?: WorkExperienceLike | null,
): { role: string | null; company: string | null } {
  const bio = parseBioHeadline(candidate?.bio)
  const role =
    dedupeTitle(candidate?.current_job_title) ||
    dedupeTitle(candidate?.role_current) ||
    dedupeTitle(latestExperience?.job_title) ||
    dedupeTitle(bio.title) ||
    null
  const company =
    candidate?.company_current?.trim() ||
    latestExperience?.company_name?.trim() ||
    bio.company ||
    null
  return { role, company }
}
