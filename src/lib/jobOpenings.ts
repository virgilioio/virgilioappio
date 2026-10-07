export type OpeningStatus = 'open' | 'offer' | 'filled' | 'cancelled'

export interface OpeningRow {
  /** DB id when persisted; temp id (`tmp-…`) for unsaved rows. */
  id: string
  req_id: string
  target_hire_date: string
  target_start_date: string
  status: OpeningStatus
  candidate_name?: string | null
  candidate_id?: string | null
  sales_deal_id?: string | null
  sales_line_id?: string | null
  fee_pct?: number | null
  persisted?: boolean
}

const REQ_RE = /^(.*?)(\d+)$/

/** Next Req ID: same prefix as the highest numeric suffix, +1. Falls back to REQ-1001. */
export function nextReqId(existing: string[]): string {
  let best: { prefix: string; n: number; width: number } | null = null
  for (const raw of existing) {
    const m = REQ_RE.exec((raw || '').trim().toUpperCase())
    if (!m) continue
    const n = parseInt(m[2], 10)
    if (!best || n > best.n) best = { prefix: m[1], n, width: m[2].length }
  }
  if (!best) return 'REQ-1001'
  return `${best.prefix}${String(best.n + 1).padStart(best.width, '0')}`
}

export function tmpId() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`
}

/** First applicable validation message per row (keyed by row id). */
export function validateOpenings(
  rows: OpeningRow[],
  serverTaken: Record<string, boolean> = {},
): Record<string, { message: string; fields: Array<'req' | 'hire' | 'start'> }> {
  const out: Record<string, { message: string; fields: Array<'req' | 'hire' | 'start'> }> = {}
  const counts = new Map<string, number>()
  rows.forEach((r) => {
    const k = r.req_id.trim().toLowerCase()
    if (k) counts.set(k, (counts.get(k) || 0) + 1)
  })
  for (const r of rows) {
    if (!r.target_hire_date || !r.target_start_date)
      out[r.id] = {
        message: 'Both dates are required.',
        fields: [!r.target_hire_date && 'hire', !r.target_start_date && 'start'].filter(Boolean) as any,
      }
    else if (r.target_start_date < r.target_hire_date)
      out[r.id] = { message: 'Target start date is before the target hire date.', fields: ['start'] }
  }
  return out
}

export function openingsSummary(rows: OpeningRow[]) {
  const n = rows.length
  const filled = rows.filter((r) => r.status === 'filled').length
  const offer = rows.filter((r) => r.status === 'offer').length
  const open = n - filled - offer
  return { n, filled, offer, open }
}

export function setupSummaryText(rows: OpeningRow[]) {
  const { n, filled, offer, open } = openingsSummary(rows)
  const parts = [`${n} ${n === 1 ? 'opening' : 'openings'}`]
  if (filled) parts.push(`${filled} filled`)
  if (offer) parts.push(`${offer} in offer`)
  if (open) parts.push(`${open} open`)
  let s = parts.join(' · ')
  if (n > 0 && open === 0) s += ' · job closes when the last offer is accepted'
  return s
}
