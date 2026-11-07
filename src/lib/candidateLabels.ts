/**
 * Readable labels for a candidate's stored source and seniority (2026-11-07):
 * "public_posting" reads "Careers page", "c_level" reads "C-level". Unknown
 * values keep their own wording, tidied.
 */
const SOURCE_LABEL: Record<string, string> = {
  apollo: 'Apollo',
  linkedin: 'LinkedIn',
  linkedin_extension: 'LinkedIn extension',
  public_posting: 'Careers page',
  'direct application': 'Careers page',
  'virgilio career page': 'Careers page',
  direct: 'Added by hand',
  csv_import: 'Import',
  job_import: 'Import',
  import: 'Import',
  pdl: 'People Data Labs',
  coresignal: 'CoreSignal',
  talent: 'Talent.com',
  'talent.com': 'Talent.com',
  'occ mundial': 'OCC',
  'occ.com.mx': 'OCC',
  referral: 'Referral',
}

const SENIORITY_LABEL: Record<string, string> = {
  intern: 'Intern',
  entry: 'Entry level',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
  manager: 'Manager',
  director: 'Director',
  vp: 'VP',
  c_level: 'C-level',
  executive: 'Executive',
}

const tidy = (value: string) => {
  const spaced = value.trim().replace(/[_]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function sourceLabel(source: string | null | undefined): string | null {
  if (!source?.trim()) return null
  return SOURCE_LABEL[source.trim().toLowerCase()] ?? source.trim()
}

export function seniorityLabel(level: string | null | undefined): string | null {
  if (!level?.trim()) return null
  return SENIORITY_LABEL[level.trim().toLowerCase()] ?? tidy(level)
}
