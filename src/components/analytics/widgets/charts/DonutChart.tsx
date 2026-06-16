import { PALETTE } from '../../model/tokens'
import type { SeriesPoint } from '../../model/types'

interface Props {
  data: SeriesPoint[]
  size?: number
}

export function DonutChart({ data, size = 200 }: Props) {
  const rows = data.slice(0, 8)
  const total = rows.reduce((s, r) => s + r.value, 0)
  const r = size / 2
  const inner = r * 0.62
  let acc = 0

  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: size }}>
        <div className="text-[12px] text-[#8B8F9E] font-inter">No data</div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        {rows.map((row, i) => {
          const frac = row.value / total
          const start = acc
          acc += frac
          const a0 = start * Math.PI * 2 - Math.PI / 2
          const a1 = acc * Math.PI * 2 - Math.PI / 2
          const large = frac > 0.5 ? 1 : 0
          const x0 = r + r * Math.cos(a0)
          const y0 = r + r * Math.sin(a0)
          const x1 = r + r * Math.cos(a1)
          const y1 = r + r * Math.sin(a1)
          const xi1 = r + inner * Math.cos(a1)
          const yi1 = r + inner * Math.sin(a1)
          const xi0 = r + inner * Math.cos(a0)
          const yi0 = r + inner * Math.sin(a0)
          const d = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0} Z`
          return <path key={i} d={d} fill={PALETTE[i % PALETTE.length]} />
        })}
        <text x={r} y={r - 4} textAnchor="middle" fontFamily="Poppins" fontWeight="600" fontSize="20" fill="#0d0d09">
          {total.toLocaleString('en-US')}
        </text>
        <text x={r} y={r + 14} textAnchor="middle" fontFamily="Inter" fontSize="11" fill="#8B8F9E">
          Total
        </text>
      </svg>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={`${row.label}-${i}`} className="flex items-center gap-2 text-[11.5px] font-inter">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-[#1F2230]" title={row.label}>{row.label}</span>
            <span className="font-poppins font-semibold tabular-nums text-[#0d0d09]">
              {Math.round((row.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
