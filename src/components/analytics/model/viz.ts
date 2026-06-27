import {
  Hash,
  TrendingUp,
  BarChart3,
  BarChart,
  PieChart,
  Filter,
  Table as TableIcon,
  type LucideIcon,
} from 'lucide-react'
import type { DimensionId, VizId } from './types'

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
}

// Which viz are valid for a given group-by
export function vizFor(group: DimensionId): VizId[] {
  switch (group) {
    case 'none':
      return ['kpi']
    case 'time':
      return ['line', 'kpi']
    case 'stage':
    case 'deal_stage':
      return ['funnel', 'bars', 'columns', 'donut', 'table']
    case 'source':
    case 'seniority':
    case 'deal_source':
      return ['bars', 'columns', 'donut', 'table']
    case 'experience':
      return ['columns', 'bars', 'table']
    case 'geography':
      return ['donut', 'bars', 'table']
    case 'job':
    case 'recruiter':
    case 'skills':
    case 'deal_owner':
    case 'company':
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
