/**
 * "Not a fit" is a per-job dismissal, kept client-side. The Suggested table and
 * the suggested profile both write through here so one list stays authoritative.
 */
const key = (jobId: string) => `gio.suggested.dismissed.${jobId}`

export function readDismissedSuggestions(jobId: string): string[] {
  try {
    const raw = localStorage.getItem(key(jobId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function writeDismissedSuggestions(jobId: string, ids: string[]) {
  try {
    localStorage.setItem(key(jobId), JSON.stringify([...new Set(ids)]))
  } catch {
    /* a full storage quota must not break the screen */
  }
}

export function dismissSuggestion(jobId: string, candidateId: string) {
  writeDismissedSuggestions(jobId, [...readDismissedSuggestions(jobId), candidateId])
}

export function restoreSuggestion(jobId: string, candidateId: string) {
  writeDismissedSuggestions(
    jobId,
    readDismissedSuggestions(jobId).filter((id) => id !== candidateId),
  )
}
