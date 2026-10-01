import { defaultSpan } from './model/viz'
import type { WidgetConfig } from './model/types'

let _id = 0
const uid = () => `seed-${Date.now()}-${++_id}`

export const SEED_RECRUITING_OVERVIEW: WidgetConfig[] = [
  { id: uid(), metric: 'applications', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: uid(), metric: 'active_candidates', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: uid(), metric: 'hires', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: uid(), metric: 'time_to_hire', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: uid(), metric: 'applications', groupBy: 'time', viz: 'line', span: 8 },
  { id: uid(), metric: 'active_candidates', groupBy: 'stage', viz: 'funnel', span: 4 },
  { id: uid(), metric: 'active_candidates', groupBy: 'stage', viz: 'bars', span: 6 },
  { id: uid(), metric: 'applications', groupBy: 'source', viz: 'donut', span: 6 },
  { id: uid(), metric: 'interviews_per_hire', groupBy: 'none', viz: 'kpi', span: 4 },
  { id: uid(), metric: 'interviews_per_hire', groupBy: 'job', viz: 'table', span: 8 },
]

export const SEED_SOURCING_QUALITY: WidgetConfig[] = [
  { id: uid(), metric: 'offers_sent', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: uid(), metric: 'offer_acceptance', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: uid(), metric: 'interviews', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: uid(), metric: 'hires', groupBy: 'none', viz: 'kpi', span: 3 },
  { id: uid(), metric: 'applications', groupBy: 'source', viz: 'table', span: 6 },
  { id: uid(), metric: 'hires', groupBy: 'seniority', viz: 'columns', span: 6 },
  { id: uid(), metric: 'applications', groupBy: 'geography', viz: 'bars', span: 6 },
  { id: uid(), metric: 'interviews', groupBy: 'time', viz: 'line', span: 6 },
]

export const SEED_PIPELINE_HYGIENE: WidgetConfig[] = [
  { id: uid(), metric: 'stuck_candidates', groupBy: 'none', viz: 'kpi', span: 4 },
  { id: uid(), metric: 'avg_days_in_stage', groupBy: 'none', viz: 'kpi', span: 4 },
  { id: uid(), metric: 'days_in_pipeline', groupBy: 'none', viz: 'kpi', span: 4 },
  { id: uid(), metric: 'avg_days_in_stage', groupBy: 'stage', viz: 'aging', span: 6 },
  { id: uid(), metric: 'avg_days_in_stage', groupBy: 'job', viz: 'aging', span: 6 },
  { id: uid(), metric: 'stuck_candidates', groupBy: 'none', viz: 'list', span: 12 },
]

export function withFreshIds(widgets: WidgetConfig[]): WidgetConfig[] {
  return widgets.map(w => ({ ...w, id: crypto.randomUUID(), span: w.span || defaultSpan(w.viz) }))
}
