import { METRICS } from './metrics'
import type { MetricId, NormalizedData, DimensionId, SeriesPoint, WidgetConfig } from './types'
import { useAnalyticsBundle } from './AnalyticsDataContext'
import type { CrmAnalyticsBundle, CrmDimensionRow } from '@/hooks/analytics/useCrmAnalyticsMetrics'

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function pickTimeSeries(
  trend: Array<Record<string, unknown>>,
  field: string,
): SeriesPoint[] {
  return trend.map(p => ({ label: String(p.date ?? ''), value: Number(p[field] ?? 0) }))
}

function delta(series: SeriesPoint[]): number | null {
  if (series.length < 4) return null
  const half = Math.floor(series.length / 2)
  const a = series.slice(0, half).reduce((s, p) => s + p.value, 0)
  const b = series.slice(half).reduce((s, p) => s + p.value, 0)
  if (a === 0) return b === 0 ? 0 : 100
  return Math.round(((b - a) / a) * 100)
}

function deltaFromValues(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 100)
}

export function useWidgetData(cfg: WidgetConfig): NormalizedData {
  const b = useAnalyticsBundle()
  const meta = METRICS[cfg.metric]
  const loading =
    b.metrics.isLoading ||
    b.stage.isLoading ||
    b.interview.isLoading ||
    b.offer.isLoading ||
    b.talent.isLoading ||
    b.source.isLoading ||
    b.recruiter.isLoading ||
    b.jobHealth.isLoading ||
    b.crm.isLoading

  const trend = asArray(b.metrics.trendData as Array<Record<string, unknown>> | undefined)

  let value: number | null = 0
  let series: SeriesPoint[] = []
  let breakdown: SeriesPoint[] = []
  let trendDelta: number | null = null
  let sparkline: SeriesPoint[] = []
  const currency = meta.format === 'money' ? b.crm.baseCurrency : undefined

  if (meta.group === 'recruiting') {
    switch (cfg.metric) {
      case 'applications':
        value = b.metrics.applications
        series = pickTimeSeries(trend, 'applications')
        break
      case 'active_candidates':
        value = b.metrics.activeCandidates
        series = pickTimeSeries(trend, 'active')
        break
      case 'hires':
        value = b.metrics.totalHires
        series = pickTimeSeries(trend, 'hires')
        break
      case 'time_to_hire':
        value = b.metrics.avgTimeToHire
        series = []
        break
      case 'interviews':
        value = b.interview.completed
        series = asArray(b.interview.trendData).map(p => ({ label: p.date, value: p.completed }))
        break
      case 'interviews_scheduled':
        value = b.interview.scheduled
        series = asArray(b.interview.trendData).map(p => ({ label: p.date, value: p.scheduled }))
        break
      case 'offers_sent':
        value = b.offer.offersSent
        series = pickTimeSeries(trend, 'offers')
        break
      case 'offer_acceptance':
        value = b.offer.conversionRate
        series = []
        break
      case 'rejections':
        value = b.metrics.rejectedCandidates
        series = pickTimeSeries(trend, 'rejected')
        break
    }
    sparkline = series
    trendDelta = delta(series)
  } else {
    // CRM metrics
    const v = b.crm.values
    const p = b.crm.previous
    const crmTrend = asArray(b.crm.trend)
    switch (cfg.metric) {
      case 'open_pipeline':
        value = v.openPipeline
        sparkline = crmTrend.map(t => ({ label: t.date, value: t.openPipeline }))
        trendDelta = deltaFromValues(v.openPipeline, p.openPipeline)
        break
      case 'revenue_won':
        value = v.revenueWon
        series = crmTrend.map(t => ({ label: t.date, value: t.revenueWon }))
        sparkline = series
        trendDelta = deltaFromValues(v.revenueWon, p.revenueWon)
        break
      case 'open_deals':
        value = v.openDeals
        sparkline = []
        trendDelta = deltaFromValues(v.openDeals, p.openDeals)
        break
      case 'deals_won':
        value = v.dealsWon
        series = crmTrend.map(t => ({ label: t.date, value: t.dealsWon }))
        sparkline = series
        trendDelta = deltaFromValues(v.dealsWon, p.dealsWon)
        break
      case 'win_rate':
        value = v.winRate
        trendDelta = deltaFromValues(v.winRate, p.winRate)
        break
      case 'avg_sales_cycle':
        value = v.avgSalesCycleDays
        trendDelta = deltaFromValues(v.avgSalesCycleDays, p.avgSalesCycleDays)
        break
      case 'avg_deal_size':
        value = v.avgDealSize
        trendDelta = deltaFromValues(v.avgDealSize, p.avgDealSize)
        break
      case 'collected':
        value = v.collected
        series = crmTrend.map(t => ({ label: t.date, value: t.collected }))
        sparkline = series
        trendDelta = deltaFromValues(v.collected, p.collected)
        break
      case 'outstanding':
        value = v.outstanding
        trendDelta = deltaFromValues(v.outstanding, p.outstanding)
        break
      case 'new_deals':
        value = v.newDeals
        series = crmTrend.map(t => ({ label: t.date, value: t.newDeals }))
        sparkline = series
        trendDelta = deltaFromValues(v.newDeals, p.newDeals)
        break
    }
  }

  // Categorical breakdowns
  if (cfg.groupBy !== 'none' && cfg.groupBy !== 'time') {
    breakdown = resolveBreakdown(cfg.metric, cfg.groupBy, b)
  }

  // Per-card scope: filter breakdown to a single category if scoped (only changes display)
  if (cfg.scope && breakdown.length > 0) {
    const filtered = breakdown.filter(p => p.label === cfg.scope!.value)
    if (filtered.length) {
      breakdown = filtered
      value = filtered.reduce((s, p) => s + p.value, 0)
    }
  }

  const empty =
    !loading &&
    (cfg.groupBy === 'none'
      ? value === 0 || value === null
      : cfg.groupBy === 'time'
      ? asArray(series).every(p => p.value === 0)
      : breakdown.length === 0)

  return {
    value,
    format: meta.format,
    currency,
    series,
    breakdown,
    trend: { delta: trendDelta, sparkline },
    loading,
    empty,
  }
}

function crmRowValue(metric: MetricId, r: CrmDimensionRow): number {
  switch (metric) {
    case 'open_pipeline': return r.openAmount
    case 'revenue_won': return r.wonAmount
    case 'open_deals': return r.openDeals
    case 'deals_won': return r.wonDeals
    case 'new_deals': return r.allDeals
    case 'collected': return r.collected
    case 'outstanding': return Math.max(0, r.openAmount + r.wonAmount - r.collected)
    case 'win_rate': {
      const closed = r.wonDeals + r.lostDeals
      return closed > 0 ? (r.wonDeals / closed) * 100 : 0
    }
    case 'avg_deal_size': return r.wonDeals > 0 ? r.wonAmount / r.wonDeals : 0
    default: return r.allDeals
  }
}

function crmBreakdown(metric: MetricId, rows: CrmDimensionRow[]): SeriesPoint[] {
  return rows
    .map(r => ({ label: r.label, value: crmRowValue(metric, r) }))
    .filter(p => p.value !== 0)
}

function resolveBreakdown(
  metric: MetricId,
  group: DimensionId,
  b: ReturnType<typeof useAnalyticsBundle>,
): SeriesPoint[] {
  // CRM dimensions
  if (group === 'deal_stage') return crmBreakdown(metric, asArray(b.crm.breakdowns?.stage))
  if (group === 'deal_owner') return crmBreakdown(metric, asArray(b.crm.breakdowns?.owner))
  if (group === 'company') return crmBreakdown(metric, asArray(b.crm.breakdowns?.company))
  if (group === 'deal_source') return crmBreakdown(metric, asArray(b.crm.breakdowns?.source))

  switch (group) {
    case 'stage':
      return asArray(b.metrics.stageDistribution).map(s => ({ label: s.name, value: s.count }))
    case 'source':
      return asArray(b.source.rows).map(r => {
        let v = r.total
        if (metric === 'hires') v = r.hires
        else if (metric === 'offers_sent') v = r.offers
        else if (metric === 'active_candidates') v = r.active
        return { label: r.source, value: v }
      })
    case 'seniority':
      return asArray(b.talent.seniorityDistribution).map(s => ({ label: s.name, value: s.count }))
    case 'skills':
      return asArray(b.talent.topSkills).slice(0, 10).map(s => ({ label: s.name, value: s.count }))
    case 'experience':
      return asArray(b.talent.experienceDistribution).map(s => ({ label: s.name, value: s.count }))
    case 'geography':
      return asArray(b.talent.geographyDistribution).slice(0, 10).map(s => ({ label: s.name, value: s.count }))
    case 'job':
      return asArray(b.jobHealth.rows).slice(0, 12).map(r => {
        let v = r.totalCandidates
        if (metric === 'hires') v = r.hires
        else if (metric === 'offers_sent') v = r.offers
        else if (metric === 'active_candidates') v = r.activeCandidates
        else if (metric === 'interviews') v = r.interviews
        else if (metric === 'rejections') v = r.rejected
        return { label: r.title, value: v }
      })
    case 'recruiter':
      return asArray(b.recruiter.rows).map(r => {
        let v = r.candidatesAdded
        if (metric === 'hires') v = r.hires
        else if (metric === 'interviews_scheduled' || metric === 'interviews') v = r.interviewsBooked
        else if (metric === 'active_candidates') v = r.activePipeline
        return { label: r.name, value: v }
      })
    default:
      return []
  }
}

export { crmBreakdown, crmRowValue }
