import { METRICS } from '../../model/metrics'
import { TONE_COLOR, TRACK } from '../../model/tokens'
import { fmt } from '../../model/format'
import type { MetricId, SeriesPoint, Format } from '../../model/types'

interface Props {
  metricId: MetricId
  data: SeriesPoint[]
  format: Format
  currency?: string
  max?: number
}

export function BarsChart({ metricId, data, format, currency, max }: Props) {
  const color = TONE_COLOR[METRICS[metricId].tone]
  const rows = data.slice(0, 10)
  const m = max ?? Math.max(1, ...rows.map(r => r.value))
  return (
    <div className="flex flex-col gap-2.5 py-1 w-full overflow-hidden">
      {rows.length === 0 && <div className="text-[12px] text-[#8B8F9E] font-inter">No data</div>}
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="flex items-center gap-3 min-w-0">
          <div
            className="text-right text-[11.5px] font-inter text-[#1F2230] truncate flex-shrink-0"
            style={{ width: 'clamp(72px, 28%, 140px)' }}
            title={r.label}
          >
            {r.label}
          </div>
          <div className="flex-1 min-w-0 h-5 rounded-[4px] relative overflow-hidden" style={{ background: TRACK }}>
            <div
              className="h-full rounded-[4px] transition-[width] duration-[400ms] ease-out"
              style={{ width: `${(r.value / m) * 100}%`, background: color }}
            />
          </div>
          <div
            className="text-right font-poppins font-semibold text-[12.5px] tabular-nums text-[#0d0d09] flex-shrink-0 truncate"
            style={{ width: 'clamp(40px, 16%, 60px)' }}
          >
            {fmt(r.value, format, currency)}
          </div>
        </div>
      ))}
    </div>
  )
}
