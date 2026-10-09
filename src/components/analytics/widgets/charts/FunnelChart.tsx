import { METRICS } from '../../model/metrics'
import { TONE_COLOR } from '../../model/tokens'
import { fmt } from '../../model/format'
import { useHoverTip } from './ChartHoverTip'
import type { MetricId, SeriesPoint, Format } from '../../model/types'
import { ChartMotion } from '@/components/ui/chart-motion'

interface Props {
  widgetId: string
  metricId: MetricId
  data: SeriesPoint[]
  format: Format
  currency?: string
}

export function FunnelChart({ widgetId, metricId, data, format, currency }: Props) {
  const tone = TONE_COLOR[METRICS[metricId].tone]
  const tip = useHoverTip()
  const rows = data
  const top = rows[0]?.value ?? 0
  return (
    <ChartMotion id={`analytics:${widgetId}`} axis="x" className="flex flex-col gap-2 py-1 w-full overflow-hidden">
      {rows.length === 0 && <div className="text-[12px] text-[#8B8F9E] font-inter">No data</div>}
      {rows.map((r, i) => {
        const widthPct = top > 0 ? (r.value / top) * 100 : 0
        const conv = i === 0 ? 100 : top > 0 ? Math.round((r.value / top) * 100) : 0
        const bg = `color-mix(in srgb, ${tone} ${Math.max(20, 100 - i * 13)}%, #fff)`
        return (
          <div key={`${r.label}-${i}`} className="flex items-center gap-3 min-w-0">
            <div
              className="text-right text-[11.5px] font-inter text-[#1F2230] truncate flex-shrink-0"
              style={{ width: 'clamp(72px, 28%, 140px)' }}
              title={r.label}
            >
              {r.label}
            </div>
            <div
              className="flex-1 min-w-0 h-6 rounded-[4px] relative overflow-hidden"
              style={{ background: '#F4F3EF' }}
              onMouseMove={e => tip.show(e, { title: r.label, rows: [
                { color: tone, label: 'Value', value: fmt(r.value, format, currency) },
                { label: 'Of first stage', value: `${conv}%` },
              ] })}
              onMouseLeave={tip.hide}
            >
              {/* The fill morphs on its own (§6); the label sits over it at the same width, so text never stretches. */}
              <div
                data-chart-bar={r.label}
                className="absolute inset-y-0 left-0 rounded-[4px]"
                style={{ width: `${widthPct}%`, background: bg }}
              />
              <div className="relative h-full flex items-center px-2" style={{ width: `${widthPct}%` }}>
                <span className="font-poppins font-semibold text-[11px] tabular-nums text-[#0d0d09] truncate">
                  {fmt(r.value, format, currency)}
                </span>
              </div>
            </div>
            <div
              className="text-right text-[11px] font-inter text-[#5A6072] tabular-nums flex-shrink-0"
              style={{ width: 'clamp(36px, 12%, 48px)' }}
            >{conv}%</div>
          </div>
        )
      })}
      {tip.node}
    </ChartMotion>
  )
}
