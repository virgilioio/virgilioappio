import { useMemo } from 'react'
import { METRICS } from '../model/metrics'
import { DIMENSIONS } from '../model/dimensions'
import { fmt } from '../model/format'
import type { NormalizedData, SalaryRange, SeriesPoint, WidgetConfig } from '../model/types'
import { useMarketBundle } from './MarketDataContext'
import { MIN_SALARIES, median, orderFor, percentile, valuesOf, type MarketRow } from './marketData'

/**
 * One Intelligence widget's numbers (Find Phase 4, 2026-10-12): people,
 * median salary or average experience over the talent database, split by a
 * market dimension, with one insight line that states the answer, its number
 * and its sample size. A salary figure is never shown from fewer than five
 * salaries; groups below that are left out and counted in a note.
 */

export interface SalaryUnit {
  currency: string
  /** multiply a base-currency monthly amount by this */
  factor: number
  per: 'month' | 'year'
}

export function salaryUnit(cfg: WidgetConfig, baseCurrency: string, rates: Record<string, number>): SalaryUnit {
  const per = cfg.salaryPeriod ?? 'month'
  const wanted = (cfg.salaryCurrency || baseCurrency).toUpperCase()
  const rate = wanted === baseCurrency ? 1 : rates[wanted]
  const currency = rate ? wanted : baseCurrency
  return { currency, factor: (rate || 1) * (per === 'year' ? 12 : 1), per }
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)
const count = (n: number) => n.toLocaleString('en-US')
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`

function lastTwelveMonths(): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(m.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
  }
  return out
}

export function useMarketWidgetData(cfg: WidgetConfig): NormalizedData {
  const m = useMarketBundle()
  const meta = METRICS[cfg.metric] ?? METRICS.mkt_people
  const dim = cfg.groupBy
  const rows = useMemo(() => m.rowsFor(dim === 'none' ? undefined : dim), [m, dim])

  return useMemo<NormalizedData>(() => {
    const unit = salaryUnit(cfg, m.baseCurrency, m.rates)
    const money = (v: number | null) => fmt(v === null ? null : v, 'money', unit.currency)
    const perWord = unit.per === 'year' ? 'a year' : 'a month'
    const salaryOf = (r: MarketRow) => (typeof r.salary_month_base === 'number' && r.salary_month_base > 0 ? r.salary_month_base * unit.factor : null)
    const salaries = (rs: MarketRow[]) => rs.map(salaryOf).filter((v): v is number => v !== null)
    const yearsOf = (rs: MarketRow[]) => rs.map(r => r.years_experience).filter((v): v is number => typeof v === 'number' && v >= 0 && v < 60)
    const filtered = m.selections.length > 0
    const scopeWord = filtered ? 'the people you picked' : 'Gio'

    const base: NormalizedData = {
      value: null,
      format: meta.format,
      currency: meta.format === 'money' ? unit.currency : undefined,
      series: [],
      breakdown: [],
      trend: { delta: null, sparkline: [] },
      loading: m.loading,
      empty: false,
    }
    if (m.loading) return base

    // ── No split: one number ──
    if (dim === 'none') {
      if (cfg.metric === 'mkt_people') {
        base.value = rows.length
        base.caption = filtered ? `of ${count(m.rows.length)} people in Gio · ${pct(rows.length, m.rows.length)}%` : 'everyone in the talent database'
      } else if (cfg.metric === 'mkt_salary') {
        const s = salaries(rows)
        if (s.length >= MIN_SALARIES) {
          base.value = median(s)
          base.caption = `${money(percentile(s, 25))}–${money(percentile(s, 75))} middle half · ${perWord} · from ${plural(s.length, 'salary', 'salaries')}`
        } else {
          base.value = null
          base.caption = s.length ? `Only ${plural(s.length, 'salary', 'salaries')} here; 5 are needed to show one` : 'No salaries on file here yet'
        }
      } else {
        const y = yearsOf(rows)
        base.value = y.length ? y.reduce((a, b) => a + b, 0) / y.length : null
        base.caption = y.length ? `from ${plural(y.length, 'person', 'people')} with experience on file` : 'No experience on file here yet'
      }
      base.empty = base.value === null && cfg.metric !== 'mkt_salary'
      return base
    }

    // ── Groups ──
    const groups = new Map<string, MarketRow[]>()
    if (dim === 'time') {
      for (const label of lastTwelveMonths()) groups.set(label, [])
    }
    for (const r of rows) {
      for (const v of valuesOf(r, dim, m.ctx)) {
        if (dim === 'time' && !groups.has(v)) continue
        const list = groups.get(v) ?? []
        list.push(r)
        groups.set(v, list)
      }
    }

    let hidden = 0
    let points: (SeriesPoint & { n: number })[] = []
    let ranges: SalaryRange[] | undefined
    if (cfg.metric === 'mkt_people') {
      points = [...groups.entries()].map(([label, rs]) => ({ label, value: rs.length, n: rs.length }))
    } else if (cfg.metric === 'mkt_salary') {
      ranges = []
      for (const [label, rs] of groups) {
        const s = salaries(rs)
        if (s.length < MIN_SALARIES) {
          if (s.length > 0) hidden++
          continue
        }
        const r: SalaryRange = { label, p25: percentile(s, 25)!, median: median(s)!, p75: percentile(s, 75)!, n: s.length }
        ranges.push(r)
        points.push({ label, value: r.median, n: r.n })
      }
    } else {
      for (const [label, rs] of groups) {
        const y = yearsOf(rs)
        if (y.length === 0) continue
        points.push({ label, value: Math.round((y.reduce((a, b) => a + b, 0) / y.length) * 10) / 10, n: y.length })
      }
    }

    const order = dim === 'time' ? lastTwelveMonths() : orderFor(dim, m.ctx.bands)
    if (order) points.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
    else points.sort((a, b) => b.value - a.value || b.n - a.n)
    if (ranges) {
      const rank = new Map(points.map((p, i) => [p.label, i]))
      ranges.sort((a, b) => (rank.get(a.label) ?? 0) - (rank.get(b.label) ?? 0))
    }

    if (dim === 'time') {
      base.series = points.map(({ label, value }) => ({ label, value }))
      base.breakdown = base.series
    } else {
      base.breakdown = points.map(({ label, value }) => ({ label, value }))
    }
    base.ranges = ranges
    base.empty = points.length === 0
    if (hidden > 0) {
      base.note = `${plural(hidden, (DIMENSIONS[dim]?.label ?? 'group').toLowerCase())} left out: fewer than 5 salaries each.`
    }

    // ── The insight line ──
    const dimWord = (DIMENSIONS[dim]?.label ?? '').toLowerCase()
    const total = rows.length
    const covered = cfg.metric === 'mkt_people'
      ? new Set([...groups.values()].flat().map(r => r.id)).size
      : 0
    if (points.length > 0) {
      if (dim === 'time') {
        const recent = points.slice(-3).reduce((s, p) => s + p.value, 0)
        base.insight = cfg.metric === 'mkt_people'
          ? `${plural(recent, 'person', 'people')} joined ${scopeWord} in the last three months.`
          : undefined
      } else if (cfg.metric === 'mkt_people') {
        const top = [...points].sort((a, b) => b.value - a.value)[0]
        const multi = DIMENSIONS[dim]?.multi
        const lead =
          dim === 'mkt_company' ? `${top.label} is where most people work now: ${count(top.value)}`
          : dim === 'mkt_past_company' ? `${top.label} is the most common past employer: ${plural(top.value, 'person', 'people')}`
          : dim === 'mkt_skills' ? `${top.label} is the most common skill: ${plural(top.value, 'person', 'people')}`
          : `${top.label} leads with ${plural(top.value, 'person', 'people')}`
        base.insight = multi
          ? `${lead}.`
          : `${lead}, ${pct(top.value, total)}% of ${count(total)}${covered < total ? ` (${count(total - covered)} have no ${dim === 'mkt_salary_band' ? 'salary' : dimWord} on file)` : ''}.`
      } else if (cfg.metric === 'mkt_salary') {
        const top = [...points].sort((a, b) => b.value - a.value)[0]
        base.insight = points.length === 1
          ? `${top.label}: median ${money(top.value)} ${perWord}, from ${plural(top.n, 'salary', 'salaries')}.`
          : `Highest median: ${top.label}, ${money(top.value)} ${perWord} from ${plural(top.n, 'salary', 'salaries')}.`
      } else {
        const top = [...points].sort((a, b) => b.value - a.value)[0]
        base.insight = `${top.label} has the most experience: ${top.value} years on average, from ${plural(top.n, 'person', 'people')}.`
      }
    } else if (cfg.metric === 'mkt_salary') {
      base.insight = hidden > 0
        ? `No ${dimWord} has 5 salaries yet, so none is shown.`
        : 'No salaries on file for these people yet.'
    }

    return base
  }, [m, rows, cfg, meta.format, dim])
}
