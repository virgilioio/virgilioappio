/**
 * Pipeline filter model — one array is the single source of truth.
 * Chips, "hidden by N filters" copy and empty-state remove pills all read it.
 */

export type PipelineFilterKind = 'favorites' | 'added' | 'fit' | 'stalled'

export interface PipelineFilter {
  /** Stable id — one per kind, so adding the same kind replaces it. */
  id: PipelineFilterKind
  label: string
  value: string
  days?: number
  min?: number
}

export interface PipelineFilterRow {
  is_favorite?: boolean | null
  created_at?: string | null
  entered_stage_at?: string | null
  ai_fit_score?: number | null
}

const daysAgo = (n: number) => Date.now() - n * 24 * 60 * 60 * 1000

export function matchesPipelineFilters(row: PipelineFilterRow, filters: PipelineFilter[]): boolean {
  for (const f of filters) {
    if (f.id === 'favorites' && !row.is_favorite) return false
    if (f.id === 'added') {
      const t = row.created_at ? new Date(row.created_at).getTime() : 0
      if (!t || t < daysAgo(f.days ?? 30)) return false
    }
    if (f.id === 'fit') {
      const s = typeof row.ai_fit_score === 'number' ? row.ai_fit_score : null
      if (s === null || s < (f.min ?? 70)) return false
    }
    if (f.id === 'stalled') {
      const t = row.entered_stage_at ? new Date(row.entered_stage_at).getTime() : 0
      if (!t || t > daysAgo(f.days ?? 14)) return false
    }
  }
  return true
}

export function matchesPipelineSearch(
  row: { candidate_name?: string | null; candidate_role?: string | null; candidate_company?: string | null },
  term: string,
): boolean {
  const q = term.trim().toLowerCase()
  if (!q) return true
  return [row.candidate_name, row.candidate_role, row.candidate_company]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q)
}

/** The Add filter menu — grouped options that produce filters. */
export const PIPELINE_FILTER_MENU: {
  group: string
  options: { key: string; label: string; filter: PipelineFilter }[]
}[] = [
  {
    group: 'Attention',
    options: [
      { key: 'fav', label: 'Favorites only', filter: { id: 'favorites', label: 'Favorites', value: 'only' } },
      { key: 'fit70', label: 'AI fit ≥ 70', filter: { id: 'fit', label: 'AI fit', value: '≥ 70', min: 70 } },
      { key: 'fit85', label: 'AI fit ≥ 85', filter: { id: 'fit', label: 'AI fit', value: '≥ 85', min: 85 } },
    ],
  },
  {
    group: 'Added',
    options: [
      { key: 'a7', label: 'Last 7 days', filter: { id: 'added', label: 'Added', value: 'last 7 days', days: 7 } },
      { key: 'a30', label: 'Last 30 days', filter: { id: 'added', label: 'Added', value: 'last 30 days', days: 30 } },
      { key: 'a90', label: 'Last 90 days', filter: { id: 'added', label: 'Added', value: 'last 90 days', days: 90 } },
    ],
  },
  {
    group: 'Time in stage',
    options: [
      { key: 's7', label: 'Stalled 7+ days', filter: { id: 'stalled', label: 'In stage', value: '7+ days', days: 7 } },
      { key: 's14', label: 'Stalled 14+ days', filter: { id: 'stalled', label: 'In stage', value: '14+ days', days: 14 } },
    ],
  },
]

/** Add or replace by kind — a pipeline never holds two "Added" filters. */
export function upsertPipelineFilter(filters: PipelineFilter[], next: PipelineFilter): PipelineFilter[] {
  return [...filters.filter((f) => f.id !== next.id), next]
}
