// Analytics widget grammar — types
export type Tone = 'purple' | 'green' | 'blue' | 'pink' | 'amber' | 'neutral'
export type Format = 'count' | 'days' | 'pct'
export type DeltaGood = 'up' | 'down'

export type MetricId =
  | 'applications'
  | 'active_candidates'
  | 'hires'
  | 'time_to_hire'
  | 'interviews'
  | 'interviews_scheduled'
  | 'offers_sent'
  | 'offer_acceptance'
  | 'rejections'

export type DimensionId =
  | 'none'
  | 'time'
  | 'stage'
  | 'job'
  | 'recruiter'
  | 'source'
  | 'seniority'
  | 'skills'
  | 'experience'
  | 'geography'

export type VizId = 'kpi' | 'line' | 'bars' | 'columns' | 'donut' | 'funnel' | 'table'

export interface WidgetScope {
  dimension: DimensionId
  value: string
}

export interface WidgetConfig {
  id: string
  metric: MetricId
  groupBy: DimensionId
  viz: VizId
  span: number
  title?: string
  scope?: WidgetScope
}

export interface SeriesPoint {
  label: string
  value: number
}

export interface NormalizedData {
  value: number | null
  format: Format
  series: SeriesPoint[] // time series (only when groupBy=time or for kpi sparklines)
  breakdown: SeriesPoint[] // categorical breakdown (when groupBy != none && != time)
  trend: { delta: number | null; sparkline: SeriesPoint[] }
  loading: boolean
  empty: boolean
}
