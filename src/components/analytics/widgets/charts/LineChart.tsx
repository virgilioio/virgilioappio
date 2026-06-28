import { useEffect, useRef, useState } from 'react'
import { TONE_COLOR, HAIRLINE_INNER } from '../../model/tokens'
import { METRICS } from '../../model/metrics'
import type { MetricId, SeriesPoint } from '../../model/types'

interface Props {
  metricId: MetricId
  series: SeriesPoint[]
  height?: number
}

export function LineChart({ metricId, series, height = 220 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const measure = () => {
      if (ref.current) setW(Math.max(0, ref.current.clientWidth))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const color = TONE_COLOR[METRICS[metricId].tone]
  const padL = 32
  const padR = 8
  const padT = 8
  const padB = 22
  const innerW = Math.max(20, w - padL - padR)
  const innerH = height - padT - padB
  const max = Math.max(1, ...series.map(p => p.value))
  const stepLabel = Math.max(1, Math.floor(series.length / 8))

  const pts = series.map((p, i) => {
    const x = padL + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
    const y = padT + innerH - (p.value / max) * innerH
    return { x, y, p, i }
  })
  const path = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  const area = pts.length ? `${path} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z` : ''
  const last = pts[pts.length - 1]

  return (
    <div ref={ref} className="w-full overflow-hidden" style={{ height }}>
      {w > 0 && (
      <svg width={w} height={height}>
        <defs>
          <linearGradient id={`line-${metricId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = padT + innerH * t
          const v = Math.round(max * (1 - t))
          return (
            <g key={t}>
              <line x1={padL} x2={padL + innerW} y1={y} y2={y} stroke={HAIRLINE_INNER} strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#8B8F9E" fontFamily="Inter">
                {v}
              </text>
            </g>
          )
        })}
        {area && <path d={area} fill={`url(#line-${metricId})`} />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {last && <circle cx={last.x} cy={last.y} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />}
        {pts
          .filter((_, i) => i % stepLabel === 0)
          .map(pt => (
            <text key={pt.i} x={pt.x} y={height - 6} textAnchor="middle" fontSize="10" fill="#8B8F9E" fontFamily="Inter">
              {pt.p.label}
            </text>
          ))}
      </svg>
      )}
    </div>
  )
}
