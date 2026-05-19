/**
 * Build a short, human-friendly reference ID for a submitted application.
 * Format: {ROLE3}-{YYYY}-{NNN}-{INIT}-{4digits}
 * e.g. DES-2026-014-LP-9821
 */
export function buildReferenceId(opts: {
  roleTitle?: string | null
  candidateName?: string | null
  applicationId?: string | null
}): string {
  const { roleTitle, candidateName, applicationId } = opts

  const role3 = (roleTitle || 'JOB')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X')

  const year = new Date().getFullYear()

  // Pull a 3-digit and 4-digit deterministic hash from the application id
  const id = (applicationId || '').replace(/-/g, '')
  const nnn = id ? parseInt(id.slice(0, 4), 16).toString().slice(-3).padStart(3, '0') : '001'
  const four = id ? parseInt(id.slice(4, 10), 16).toString().slice(-4).padStart(4, '0') : '0000'

  const initials = (candidateName || '')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'XX'

  return `${role3}-${year}-${nnn}-${initials}-${four}`
}

export function firstNameOf(fullName?: string | null): string {
  if (!fullName) return 'there'
  const tok = fullName.trim().split(/\s+/)[0]
  return tok || 'there'
}
