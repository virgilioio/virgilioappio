/**
 * Why a job closed (Allan, 2026-11-24). The keys and words match the database
 * (`jobs.close_reason`, `job_close_reason_label()`), which also sends the words
 * to Gio Sales. Every close and archive asks for one; Other needs a note.
 * `not_recorded` is never offered: it's what a close that named none reads as.
 */
export type JobCloseReason =
  | 'filled'
  | 'client_cancelled'
  | 'on_hold'
  | 'filled_elsewhere'
  | 'role_changed'
  | 'duplicate'
  | 'other'
  | 'not_recorded'

export const JOB_CLOSE_REASONS: { key: Exclude<JobCloseReason, 'not_recorded'>; label: string }[] = [
  { key: 'filled', label: 'Filled' },
  { key: 'client_cancelled', label: 'Client cancelled the search' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'filled_elsewhere', label: 'Filled elsewhere' },
  { key: 'role_changed', label: 'Budget or role changed' },
  { key: 'duplicate', label: 'Duplicate or opened by mistake' },
  { key: 'other', label: 'Other' },
]

export const CLOSE_NOTE_MAX = 500

export function jobCloseReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  if (reason === 'not_recorded') return 'Not recorded'
  return JOB_CLOSE_REASONS.find((r) => r.key === reason)?.label ?? null
}

/** "Filled", "Other: Merged into another search", "Not recorded". */
export function jobCloseReasonText(reason: string | null | undefined, note?: string | null): string | null {
  const label = jobCloseReasonLabel(reason)
  if (!label) return null
  const n = note?.trim()
  return reason === 'other' && n ? n : n ? `${label} · ${n}` : label
}

/** The closing problem a save can return, in words (never the server's text). */
export function closeReasonProblem(reason: string | null, note: string): string | null {
  if (!reason) return 'Pick why the job is closing.'
  if (reason === 'other' && !note.trim()) return 'Say why the job is closing.'
  if (note.length > CLOSE_NOTE_MAX) return `Keep the note under ${CLOSE_NOTE_MAX} characters.`
  return null
}
