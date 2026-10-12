import {
  Hash,
  TrendingUp,
  BarChart3,
  BarChart,
  PieChart,
  Filter,
  Table as TableIcon,
  AlignLeft,
  ListOrdered,
  Ruler,
  Map as MapIcon,
  type LucideIcon,
} from 'lucide-react'
import type { DimensionId, MetricId, VizId } from './types'

export interface VizDef {
  id: VizId
  label: string
  icon: LucideIcon
  allowedSpans: number[]
}

export const VIZ: Record<VizId, VizDef> = {
  kpi:     { id: 'kpi',     label: 'Single number', icon: Hash,        allowedSpans: [3, 4, 6] },
  line:    { id: 'line',    label: 'Line / area',   icon: TrendingUp,  allowedSpans: [6, 8, 12] },
  bars:    { id: 'bars',    label: 'Bar',           icon: BarChart3,   allowedSpans: [4, 6, 12] },
  columns: { id: 'columns', label: 'Columns',       icon: BarChart,    allowedSpans: [4, 6, 12] },
  donut:   { id: 'donut',   label: 'Donut',         icon: PieChart,    allowedSpans: [4, 6, 8] },
  funnel:  { id: 'funnel',  label: 'Funnel',        icon: Filter,      allowedSpans: [4, 6, 12] },
  table:   { id: 'table',   label: 'Table',         icon: TableIcon,   allowedSpans: [6, 8, 12] },
  aging:   { id: 'aging',   label: 'Aging buckets', icon: AlignLeft,   allowedSpans: [6, 8, 12] },
  list:    { id: 'list',    label: 'Stuck list',    icon: ListOrdered, allowedSpans: [6, 8, 12] },
  salary_range: { id: 'salary_range', label: 'Salary range', icon: Ruler,  allowedSpans: [6, 8, 12] },
  map:     { id: 'map',     label: 'Map',           icon: MapIcon,     allowedSpans: [8, 12, 6] },
}

/** Intelligence: which viz fit a market metric split by a dimension. */
export function marketVizFor(metric: MetricId, group: DimensionId): VizId[] {
  if (group === 'none') return ['kpi']
  if (group === 'time') return metric === 'mkt_people' ? ['line', 'columns'] : ['line']
  if (metric === 'mkt_salary') return ['salary_range', 'bars', 'table']
  if (group === 'mkt_country') return ['map', 'bars', 'donut', 'table']
  if (group === 'mkt_seniority' || group === 'mkt_role_family' || group === 'mkt_source') return ['bars', 'donut', 'columns', 'table']
  if (group === 'mkt_experience' || group === 'mkt_salary_band') return ['columns', 'bars', 'table']
  return ['bars', 'table']
}

// Which viz are valid for a given group-by
export function vizFor(group: DimensionId, hygiene = false): VizId[] {
  if (hygiene) {
    if (group === 'none') return ['kpi', 'list']
    if (group === 'stage' || group === 'job' || group === 'recruiter') return ['aging', 'bars', 'table']
    return ['kpi']
  }
  switch (group) {
    case 'none':
      return ['kpi']
    case 'time':
      return ['line', 'kpi']
    case 'stage':
      return ['funnel', 'bars', 'columns', 'donut', 'table']
    case 'source':
    case 'seniority':
      return ['bars', 'columns', 'donut', 'table']
    case 'experience':
      return ['columns', 'bars', 'table']
    case 'geography':
      return ['donut', 'bars', 'table']
    case 'job':
    case 'recruiter':
    case 'skills':
      return ['bars', 'table']
    default:
      return ['table']
  }
}

export function nextSpan(viz: VizId, currentSpan: number): number {
  const spans = VIZ[viz].allowedSpans
  const idx = spans.indexOf(currentSpan)
  if (idx === -1) return spans[0]
  return spans[(idx + 1) % spans.length]
}

export function defaultSpan(viz: VizId): number {
  return VIZ[viz].allowedSpans[0]
}
