import { METRICS } from '../../model/metrics'
import { TONE_COLOR } from '../../model/tokens'
import { fmt } from '../../model/format'
import type { MetricId, SeriesPoint, Format } from '../../model/types'

interface Props {
  metricId: MetricId
  data: SeriesPoint[]
  format: Format
}

export function FunnelChart({ metricId, data, format }: Props) {
  const tone = TONE_COLOR[METRICS[metricId].tone]
  const rows = data
  const top = rows[0]?.value ?? 0
  return (
    <div className="flex flex-col gap-2 py-1">
      {rows.length === 0 && <div className="text-[12px] text-[#8B8F9E] font-inter">No data</div>}
      {rows.map((r, i) => {
        const widthPct = top > 0 ? (r.value / top) * 100 : 0
        const conv = i === 0 ? 100 : top > 0 ? Math.round((r.value / top) * 100) : 0
        const bg = `color-mix(in srgb, ${tone} ${Math.max(20, 100 - i * 13)}%, #fff)`
        return (
          <div key={`${r.label}-${i}`} className="flex items-center gap-3">
            <div className="w-[110px] text-right text-[11.5px] font-inter text-[#1F2230] truncate" title={r.label}>
              {r.label}
            </div>
            <div className="flex-1 h-6 rounded-[4px] relative overflow-hidden" style={{ background: '#F4F3EF' }}>
              <div
                className="h-full rounded-[4px] flex items-center px-2 transition-[width] duration-[400ms]"
                style={{ width: `${widthPct}%`, background: bg }}
              >
                <span className="font-poppins font-semibold text-[11px] tabular-nums text-[#0d0d09]">
                  {fmt(r.value, format)}
                </span>
              </div>
            </div>
            <div className="w-[42px] text-right text-[11px] font-inter text-[#5A6072] tabular-nums">{conv}%</div>
          </div>
        )
      })}
    </div>
  )
}
