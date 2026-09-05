/**
 * ONE grid template, shared by the header row, every data row and every
 * skeleton row. A second copy would drift and the skeleton would stop lining
 * up, so this constant is the only definition.
 */
export const SUGGESTED_GRID = '28px minmax(0,1.65fr) minmax(0,2.1fr) 96px minmax(0,0.85fr) 96px 128px 116px'

export const suggestedRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: SUGGESTED_GRID,
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  minHeight: 64,
}

/** Tiered match colour. */
export function matchColor(score: number): string {
  if (score >= 88) return '#12B886'
  if (score >= 78) return '#6F3FF5'
  return '#F59E0B'
}

export const SUGGESTED_COLUMNS: { key: string; label: string; sortable?: boolean; align?: 'right' }[] = [
  { key: 'select', label: '' },
  { key: 'candidate', label: 'Candidate' },
  { key: 'reasons', label: 'Why Gio suggested them' },
  { key: 'match', label: 'Match', sortable: true, align: 'right' },
  { key: 'location', label: 'Location' },
  { key: 'active', label: 'Last active', sortable: true },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '' },
]

export type SuggestedSortKey = 'match' | 'active'
