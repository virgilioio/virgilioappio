import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { easingFunction, motionToken, prefersReducedMotion } from '@/lib/motion'
import { TONE_COLOR, HAIRLINE_INNER } from '../../model/tokens'
import { METRICS } from '../../model/metrics'
import { useHoverTip } from './ChartHoverTip'
import type { MetricId, SeriesPoint } from '../../model/types'

interface Props {
  metricId: MetricId
  series: SeriesPoint[]
  height?: number
}

/** A line as fractions of the plot: f = across (0..1), v = up from the baseline (0..1). */
type Shape = { f: number; v: number }[]

function valueAt(shape: Shape, f: number) {
  if (!shape.length) return 0
  if (f <= shape[0].f) return shape[0].v
  for (let i = 1; i < shape.length; i++) {
    const a = shape[i - 1]
    const b = shape[i]
    if (f <= b.f) return b.f === a.f ? b.v : a.v + ((f - a.f) / (b.f - a.f)) * (b.v - a.v)
  }
  return shape[shape.length - 1].v
}

/**
 * Motion & Feel §6 Charts: when the data changes (a period or filter change), the line
 * morphs from where it is on screen to its new values over --dur-chart on --ease-in-out.
 * A different number of points is handled by reading the old line at the new x positions.
 * First render, and reduced motion, draw the line as it is.
 */
function useMorphedShape(target: Shape): Shape {
  const signature = target.map((p) => `${p.f.toFixed(4)}:${p.v.toFixed(4)}`).join(',')
  const [shown, setShown] = useState(target)
  const current = useRef(target)
  const first = useRef(true)
  const targetRef = useRef(target)
  targetRef.current = target
  useLayoutEffect(() => {
    const to = targetRef.current
    if (first.current || prefersReducedMotion() || !current.current.length) {
      first.current = false
      current.current = to
      setShown(to)
      return
    }
    const from = to.map((p) => valueAt(current.current, p.f))
    const duration = motionToken('--dur-chart', 320)
    const ease = easingFunction(motionToken('--ease-in-out', 'cubic-bezier(0.77, 0, 0.175, 1)'))
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const e = ease(Math.min(1, (now - start) / duration))
      const next = to.map((p, i) => ({ f: p.f, v: from[i] + (p.v - from[i]) * e }))
      current.current = next
      setShown(next)
      if (e < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [signature])
  return shown
}

export function LineChart({ metricId, series, height = 220 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [hi, setHi] = useState<number | null>(null)
  const tip = useHoverTip()
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
  // What's drawn follows the morphing shape; hover and labels use the real points.
  const shape = useMorphedShape(
    series.map((p, i) => ({ f: series.length <= 1 ? 0.5 : i / (series.length - 1), v: p.value / max })),
  )
  const drawn = shape.map(({ f, v }) => ({ x: padL + f * innerW, y: padT + innerH - v * innerH }))
  const path = drawn.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  const area = drawn.length ? `${path} L ${drawn[drawn.length - 1].x} ${padT + innerH} L ${drawn[0].x} ${padT + innerH} Z` : ''
  const last = drawn[drawn.length - 1]

  return (
    <div ref={ref} className="w-full overflow-hidden" style={{ height }}>
      {w > 0 && (
      <svg
        width={w}
        height={height}
        onMouseMove={e => {
          if (!pts.length) return
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const mx = e.clientX - rect.left
          let best = pts[0]
          for (const pt of pts) if (Math.abs(pt.x - mx) < Math.abs(best.x - mx)) best = pt
          setHi(best.i)
          tip.show(e, { title: best.p.label, rows: [{ color, label: METRICS[metricId].label ?? 'Value', value: best.p.value.toLocaleString('en-US') }] })
        }}
        onMouseLeave={() => { setHi(null); tip.hide() }}
      >
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
        {hi !== null && pts[hi] && (
          <g pointerEvents="none">
            <line x1={pts[hi].x} x2={pts[hi].x} y1={padT} y2={padT + innerH} stroke={color} strokeOpacity={0.35} strokeDasharray="3 3" />
            <circle cx={pts[hi].x} cy={pts[hi].y} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
          </g>
        )}
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
      {tip.node}
    </div>
  )
}
