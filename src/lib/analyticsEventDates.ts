/**
 * When did this association's current outcome actually happen?
 * Uses the real event column (hired_at / offered_at / rejected_at) and only
 * falls back to updated_at when it's missing — updated_at moves on any edit.
 */
export function eventAt(a: {
  status?: string | null
  hired_at?: string | null
  offered_at?: string | null
  rejected_at?: string | null
  updated_at?: string | null
}): Date {
  const d =
    a.status === 'hired' ? a.hired_at :
    a.status === 'offer' ? a.offered_at :
    a.status === 'rejected' ? a.rejected_at : null
  return new Date((d || a.updated_at) as string)
}

export const EVENT_DATE_COLUMNS = 'hired_at, offered_at, rejected_at'
