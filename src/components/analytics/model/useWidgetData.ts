import { METRICS } from './metrics'
import type { MetricId, NormalizedData, DimensionId, SeriesPoint, WidgetConfig } from './types'
import { useAnalyticsBundle } from './AnalyticsDataContext'
import { bucketOf, type AgingCandidate } from '@/hooks/analytics/usePipelineAgingMetrics'

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
  const meta = METRICS[cfg.metric] ?? METRICS.applications
  const loading =
    b.metrics.isLoading ||
    b.stage.isLoading ||
    b.interview.isLoading ||
    b.offer.isLoading ||
    b.talent.isLoading ||
    b.source.isLoading ||
    b.recruiter.isLoading ||
    b.jobHealth.isLoading ||
    b.iph.isLoading ||
    b.aging.isLoading

  const trend = asArray(b.metrics.trendData as Array<Record<string, unknown>> | undefined)

  let value: number | null = 0
  let series: SeriesPoint[] = []
  let breakdown: SeriesPoint[] = []
  let trendDelta: number | null = null
  let sparkline: SeriesPoint[] = []
  const currency: string | undefined = undefined
  let caption: string | undefined
  let aging: NormalizedData['aging']
  let list: NormalizedData['list']
  let note: string | undefined
  const threshold = cfg.threshold ?? 14

  if (meta.group === 'hygiene') {
    const all = b.aging.candidates
    const scoped = cfg.scope ? all.filter(c => hygieneKey(c, cfg.scope!.dimension) === cfg.scope!.value) : all
    const pool = cfg.metric === 'stuck_candidates' ? scoped.filter(c => c.daysInStage > threshold) : scoped
    const days = (c: AgingCandidate) => (cfg.metric === 'days_in_pipeline' ? c.daysInPipeline : c.daysInStage)
    const avg = (xs: AgingCandidate[]) => (xs.length ? Math.round(xs.reduce((s, c) => s + days(c), 0) / xs.length) : null)
    value = cfg.metric === 'stuck_candidates' ? pool.length : avg(pool)
    caption =
      cfg.metric === 'stuck_candidates'
        ? `in the same stage over ${threshold}d · of ${scoped.length} active`
        : `${scoped.length} active candidate${scoped.length === 1 ? '' : 's'} · right now`
    const est = pool.filter(c => c.estimated && cfg.metric !== 'days_in_pipeline').length
    if (est) note = `Stage-entry date estimated for ${est} candidate${est === 1 ? '' : 's'}`
    if (cfg.groupBy === 'stage' || cfg.groupBy === 'job' || cfg.groupBy === 'recruiter') {
      const g = new Map<string, { list: AgingCandidate[]; order: number }>()
      for (const c of pool) {
        const k = hygieneKey(c, cfg.groupBy)
        const e = g.get(k) || { list: [], order: cfg.groupBy === 'stage' ? c.stagePosition : 0 }
        e.list.push(c)
        g.set(k, e)
      }
      const entries = [...g.entries()]
      breakdown = entries
        .map(([label, e]) => ({ label, value: cfg.metric === 'stuck_candidates' ? e.list.length : avg(e.list) ?? 0, order: e.order }))
        .sort((x, y) => (cfg.groupBy === 'stage' ? x.order - y.order : y.value - x.value))
        .map(({ label, value }) => ({ label, value }))
      aging = entries
        .map(([label, e]) => {
          const buckets = [0, 0, 0, 0]
          e.list.forEach(c => buckets[bucketOf(days(c))]++)
          return { label, buckets, order: e.order, total: e.list.length }
        })
        .sort((x, y) => (cfg.groupBy === 'stage' ? x.order - y.order : y.total - x.total))
        .map(({ label, buckets }) => ({ label, buckets }))
    }
    list = [...pool].sort((x, y) => days(y) - days(x))
      .map(c => ({
        id: c.associationId,
        href: `/jobs/${c.jobId}?candidate=${c.candidateId}`,
        name: c.name,
        job: c.job,
        stage: c.stage,
        days: days(c),
        estimated: c.estimated && cfg.metric !== 'days_in_pipeline',
      }))
  } else if (meta.group === 'recruiting') {
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
      case 'interviews_per_hire':
        value = b.iph.ratio
        caption = `${b.iph.screenings} screening${b.iph.screenings === 1 ? '' : 's'} · ${b.iph.hires} hire${b.iph.hires === 1 ? '' : 's'}`
        // Months without hires are omitted (ratio undefined)
        series = b.iph.monthly
          .filter(m => m.hires > 0)
          .map(m => ({ label: m.label, value: Math.round((m.screenings / m.hires) * 10) / 10 }))
        break
    }
    sparkline = series
    trendDelta = delta(series)
  }

  // Categorical breakdowns
  if (meta.group !== 'hygiene' && cfg.groupBy !== 'none' && cfg.groupBy !== 'time') {
    breakdown = resolveBreakdown(cfg.metric, cfg.groupBy, b)
  }

  // Per-card scope: filter breakdown to a single category if scoped (only changes display)
  if (cfg.scope && breakdown.length > 0 && cfg.metric !== 'interviews_per_hire' && meta.group !== 'hygiene') {
    const filtered = breakdown.filter(p => p.label === cfg.scope!.value)
    if (filtered.length) {
      breakdown = filtered
      value = filtered.reduce((s, p) => s + p.value, 0)
    }
  }

  const empty =
    !loading &&
    (meta.group === 'hygiene'
      ? b.aging.candidates.length === 0
      : cfg.groupBy === 'none'
      ? value === null || value === undefined
      : cfg.groupBy === 'time'
      ? false
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
    caption,
    aging,
    list,
    note,
  }
}

function hygieneKey(c: AgingCandidate, dim: DimensionId): string {
  return dim === 'job' ? c.job : dim === 'recruiter' ? c.recruiter : c.stage
}

function resolveBreakdown(
  metric: MetricId,
  group: DimensionId,
  b: ReturnType<typeof useAnalyticsBundle>,
): SeriesPoint[] {

  if (metric === 'interviews_per_hire') {
    const rows = group === 'job' ? b.iph.byJob : group === 'recruiter' ? b.iph.byRecruiter : []
    return rows
      .filter(r => r.hires > 0)
      .map(r => ({ label: r.label, value: Math.round((r.screenings / r.hires) * 10) / 10 }))
      .sort((x, y) => x.value - y.value)
  }

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

