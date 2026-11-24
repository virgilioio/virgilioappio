// Job IDs (2026-11-24): every job's `job_code`, VG- and four letters or numbers
// (VG-7K3P), assigned and locked by the database. These helpers let any job
// search find a job by its ID however it's typed: "VG-7K3P", "vg7k3p",
// "VG 7K3P" or just "7K3P".

const CODE_CHARS = /^[2-9A-HJKMNP-Z]{1,4}$/

/** The ID's searchable form: upper case, no prefix, no dash or spaces ("7K3P"). */
export function jobCodeCore(value: string | null | undefined): string {
  return (value || '').toUpperCase().replace(/[\s-]+/g, '').replace(/^VG/, '')
}

/**
 * Whether a search box's text is (part of) a Job ID: a VG prefix with up to
 * four characters, or four characters on their own. Two or three characters
 * alone are too short to say, so plain words still search titles.
 */
export function looksLikeJobCode(query: string): boolean {
  const raw = (query || '').trim().toUpperCase().replace(/\s+/g, '')
  if (!raw) return false
  if (/^VG-?/.test(raw)) {
    const rest = raw.replace(/^VG-?/, '')
    return rest === '' || CODE_CHARS.test(rest)
  }
  return /^[2-9A-HJKMNP-Z]{4}$/.test(raw) && /\d/.test(raw)
}

/** Whether a job's ID matches what was typed (see looksLikeJobCode). */
export function jobCodeMatches(code: string | null | undefined, query: string): boolean {
  if (!code || !looksLikeJobCode(query)) return false
  const want = jobCodeCore(query)
  return want === '' ? true : jobCodeCore(code).startsWith(want)
}

/**
 * The text a client-side job search compares with: what it already searched,
 * plus the ID in its plain and compact forms, so "vg-7k3p" and "7k3p" hit.
 */
export function withJobCode(haystack: string, code: string | null | undefined): string {
  if (!code) return haystack
  return `${haystack} ${code} ${jobCodeCore(code)}`
}
