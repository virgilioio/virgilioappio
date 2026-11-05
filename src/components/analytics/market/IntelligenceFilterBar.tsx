import { useMemo } from 'react'
import { Briefcase } from 'lucide-react'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import type { DimensionId } from '../model/types'
import { useMarketBundle } from './MarketDataContext'
import { valuesOf } from './marketData'
import { ADDED_PERIODS, CAME_IN_ORDER, JOB_STATE_ORDER, JOB_STATUS_ORDER } from './jobLinks'

/**
 * Intelligence by job and client (2026-11-05): the filter bar over every widget.
 * Each popover writes the same page selections as clicking a chart, so the chips, the
 * saved view and the CSV follow it. Counts are people, given every other filter.
 */
const FILTERS: { dim: DimensionId; label: string; searchable?: boolean }[] = [
  { dim: 'mkt_client', label: 'Client', searchable: true },
  { dim: 'mkt_job', label: 'Job', searchable: true },
  { dim: 'mkt_job_status', label: 'Job status' },
  { dim: 'mkt_job_state', label: 'In the job as' },
  { dim: 'mkt_came_in', label: 'Came in' },
  { dim: 'mkt_added', label: 'Added to the job' },
]

export function IntelligenceFilterBar() {
  const m = useMarketBundle()
  const picked = (dim: DimensionId) => m.selections.filter(s => s.dimension === dim).map(s => s.value)

  const counts = useMemo(() => {
    const out = new Map<DimensionId, Map<string, number>>()
    if (m.loading) return out
    for (const { dim } of FILTERS) {
      const rows = m.rowsFor(dim)
      const ctx = m.ctxFor(dim)
      const per = new Map<string, number>()
      for (const r of rows) for (const v of new Set(valuesOf(r, dim, ctx))) per.set(v, (per.get(v) ?? 0) + 1)
      out.set(dim, per)
    }
    return out
  }, [m])

  const options = (dim: DimensionId): FilterChipOption[] => {
    const per = counts.get(dim) ?? new Map<string, number>()
    const opt = (value: string): FilterChipOption => ({ value, label: value, count: per.get(value) ?? 0 })
    const present = (order: readonly string[]) => order.filter(v => per.has(v) || picked(dim).includes(v)).map(opt)
    switch (dim) {
      case 'mkt_client':
        return m.jobs.clients.map(c => opt(c.label))
      case 'mkt_job': {
        // With clients picked, only their jobs (plus any job already picked).
        const clients = new Set(picked('mkt_client'))
        const chosen = new Set(picked('mkt_job'))
        return m.jobs.jobs
          .filter(j => clients.size === 0 || clients.has(j.client) || chosen.has(j.label))
          .map(j => ({ value: j.label, label: clients.size === 1 ? j.title : j.label, count: per.get(j.label) ?? 0 }))
      }
      case 'mkt_job_status': return present(JOB_STATUS_ORDER)
      case 'mkt_job_state': return present(JOB_STATE_ORDER)
      case 'mkt_came_in': return present(CAME_IN_ORDER)
      case 'mkt_added': return ADDED_PERIODS.map(opt)
      default: return []
    }
  }

  if (!m.loading && m.jobs.jobs.length === 0) {
    return (
      <div className="mb-3 min-h-[32px] flex items-center gap-1.5 text-[12px] font-inter text-[#6B7080]">
        <Briefcase size={13} aria-hidden />
        No jobs you can see have candidates yet, so there's nothing to filter by job.
      </div>
    )
  }

  return (
    <div className="mb-3 min-h-[32px] flex flex-wrap items-center gap-2" aria-label="Filter by job">
      {FILTERS.map(f => (
        <FilterChipPopover
          key={f.dim}
          label={f.label}
          options={options(f.dim)}
          selectedValues={picked(f.dim)}
          onSelectionChange={values => m.setDimension(f.dim, values)}
          searchable={f.searchable}
        />
      ))}
    </div>
  )
}
