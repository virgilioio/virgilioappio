import { ArrowDown, ArrowUp } from 'lucide-react'
import { METRICS } from '../../model/metrics'
import { TONE_COLOR } from '../../model/tokens'
import { fmt } from '../../model/format'
import type { MetricId, NormalizedData } from '../../model/types'

interface Props {
  metricId: MetricId
  data: NormalizedData
}

export function KpiChart({ metricId, data }: Props) {
  const meta = METRICS[metricId]
  const color = TONE_COLOR[meta.tone]
  const series = data.trend.sparkline
  const max = Math.max(1, ...series.map(p => p.value))
  const w = 120
  const h = 38
  const path =
    series.length > 1
      ? series
          .map((p, i) => {
            const x = (i / (series.length - 1)) * w
            const y = h - (p.value / max) * h
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
          })
          .join(' ')
      : ''
  const area = path ? `${path} L ${w} ${h} L 0 ${h} Z` : ''

  const delta = data.trend.delta
  const positive = delta !== null && delta >= 0
  const good = positive === (meta.deltaGood === 'up')
  const deltaColor = delta === null ? '#8B8F9E' : good ? '#12B886' : '#FA5252'
  const Arrow = positive ? ArrowUp : ArrowDown

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-end justify-between gap-3">
        <div className="font-poppins font-semibold text-[34px] leading-none tracking-[-0.02em] text-[#0d0d09]">
          {fmt(data.value, data.format, data.currency)}
        </div>
        {series.length > 0 && (
          <svg width={w} height={h} className="flex-shrink-0">
            <defs>
              <linearGradient id={`spark-${metricId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#spark-${metricId})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-inter">
        {delta !== null ? (
          <>
            <Arrow size={12} style={{ color: deltaColor }} strokeWidth={2.5} />
            <span style={{ color: deltaColor }} className="font-medium">
              {Math.abs(delta)}%
            </span>
            <span className="text-[#8B8F9E]">vs. previous period</span>
          </>
        ) : (
          <span className="text-[#8B8F9E]">No comparison available</span>
        )}
      </div>
    </div>
  )
}
