import { METRICS } from './metrics'
import type { MetricId, NormalizedData, DimensionId, SeriesPoint, WidgetConfig } from './types'
import { useAnalyticsBundle } from './AnalyticsDataContext'

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
    b.jobHealth.isLoading

  const trend = b.metrics.trendData as Array<Record<string, unknown>>

  // Map metric → its primary scalar value + time series field on metrics.trendData
  let value: number | null = 0
  let series: SeriesPoint[] = []
  let breakdown: SeriesPoint[] = []

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
      value = b.metrics.totalHires ?? (b.metrics as any).totalHires ?? 0
      // useAnalyticsMetrics surface doesn't expose totalHires; derive from trendData
      if (!value) value = trend.reduce((s, p) => s + Number(p.hires ?? 0), 0)
      series = pickTimeSeries(trend, 'hires')
      break
    case 'time_to_hire':
      value = (b.metrics as any).avgTimeToHire ?? null
      series = []
      break
    case 'interviews':
      value = b.interview.completed
      series = (b.interview.trendData || []).map(p => ({ label: p.date, value: p.completed }))
      break
    case 'interviews_scheduled':
      value = b.interview.scheduled
      series = (b.interview.trendData || []).map(p => ({ label: p.date, value: p.scheduled }))
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
      ? series.every(p => p.value === 0)
      : breakdown.length === 0)

  return {
    value,
    format: meta.format,
    series,
    breakdown,
    trend: { delta: delta(series), sparkline: series },
    loading,
    empty,
  }
}

function resolveBreakdown(
  metric: MetricId,
  group: DimensionId,
  b: ReturnType<typeof useAnalyticsBundle>,
): SeriesPoint[] {
  switch (group) {
    case 'stage':
      return (b.metrics.stageDistribution || []).map(s => ({ label: s.name, value: s.count }))
    case 'source':
      return (b.source.rows || []).map(r => {
        let v = r.total
        if (metric === 'hires') v = r.hires
        else if (metric === 'offers_sent') v = r.offers
        else if (metric === 'active_candidates') v = r.active
        return { label: r.source, value: v }
      })
    case 'seniority':
      return (b.talent.seniorityDistribution || []).map(s => ({ label: s.name, value: s.count }))
    case 'skills':
      return (b.talent.topSkills || []).slice(0, 10).map(s => ({ label: s.name, value: s.count }))
    case 'experience':
      return (b.talent.experienceDistribution || []).map(s => ({ label: s.name, value: s.count }))
    case 'geography':
      return (b.talent.geographyDistribution || []).slice(0, 10).map(s => ({ label: s.name, value: s.count }))
    case 'job':
      return (b.jobHealth.rows || []).slice(0, 12).map(r => {
        let v = r.totalCandidates
        if (metric === 'hires') v = r.hires
        else if (metric === 'offers_sent') v = r.offers
        else if (metric === 'active_candidates') v = r.activeCandidates
        else if (metric === 'interviews') v = r.interviews
        else if (metric === 'rejections') v = r.rejected
        return { label: r.title, value: v }
      })
    case 'recruiter':
      return (b.recruiter.rows || []).map(r => {
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
