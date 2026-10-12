// Analytics widget grammar — types
export type Tone = 'purple' | 'green' | 'blue' | 'pink' | 'amber' | 'neutral'
export type Format = 'count' | 'days' | 'pct' | 'money' | 'ratio' | 'years'
export type DeltaGood = 'up' | 'down'

export type MetricId =
  // Recruiting / ATS
  | 'applications'
  | 'active_candidates'
  | 'hires'
  | 'time_to_hire'
  | 'interviews'
  | 'interviews_scheduled'
  | 'offers_sent'
  | 'offer_acceptance'
  | 'rejections'
  | 'interviews_per_hire'
  // Pipeline hygiene (snapshot)
  | 'avg_days_in_stage'
  | 'stuck_candidates'
  | 'days_in_pipeline'
  // Market (Intelligence): the whole talent database
  | 'mkt_people'
  | 'mkt_salary'
  | 'mkt_experience'

export type MetricGroup = 'recruiting' | 'hygiene' | 'market'

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
  // Market (Intelligence): people in the whole talent database
  | 'mkt_country'
  | 'mkt_city'
  | 'mkt_role_family'
  | 'mkt_title'
  | 'mkt_specialization'
  | 'mkt_seniority'
  | 'mkt_company'
  | 'mkt_past_company'
  | 'mkt_salary_band'
  | 'mkt_experience'
  | 'mkt_skills'
  | 'mkt_source'

export type VizId = 'kpi' | 'line' | 'bars' | 'columns' | 'donut' | 'funnel' | 'table' | 'aging' | 'list' | 'salary_range' | 'map'

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
  /** Pipeline hygiene: days before a candidate counts as stuck (default 14) */
  threshold?: number
  /** Market salary: per month (default) or per year */
  salaryPeriod?: 'month' | 'year'
  /** Market salary: the currency to show (default: the workspace's base currency) */
  salaryCurrency?: string
}

/** A salary spread for one group (Intelligence). Groups under 5 salaries are never shown. */
export interface SalaryRange {
  label: string
  p25: number
  median: number
  p75: number
  n: number
}

export interface SeriesPoint {
  label: string
  value: number
}

export interface NormalizedData {
  value: number | null
  format: Format
  /** ISO currency code for money formatting (base currency). */
  currency?: string
  series: SeriesPoint[] // time series (only when groupBy=time or for kpi sparklines)
  breakdown: SeriesPoint[] // categorical breakdown (when groupBy != none && != time)
  trend: { delta: number | null; sparkline: SeriesPoint[] }
  loading: boolean
  empty: boolean
  /** Optional one-line context under a KPI (replaces the period comparison) */
  caption?: string
  /** Aging buckets per category (0–7, 8–14, 15–30, 30+ days) */
  aging?: { label: string; buckets: number[] }[]
  /** Candidate rows for the stuck list */
  list?: { id: string; href: string; name: string; job: string; stage: string; days: number; estimated: boolean }[]
  /** Small honesty note, e.g. estimated dates */
  note?: string
  /** Market: salary spread per group */
  ranges?: SalaryRange[]
  /** Market: the answer in one line, with its number and sample size */
  insight?: string
}
