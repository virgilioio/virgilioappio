import { PALETTE } from '../../model/tokens'
import { fmt } from '../../model/format'
import type { SeriesPoint, Format } from '../../model/types'

interface Props {
  data: SeriesPoint[]
  format: Format
  currency?: string
  height?: number
}

export function ColumnsChart({ data, format, currency, height = 220 }: Props) {
  const rows = data.slice(0, 10)
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <div className="flex items-end gap-2 pt-2" style={{ height }}>
      {rows.length === 0 && <div className="text-[12px] text-[#8B8F9E] font-inter">No data</div>}
      {rows.map((r, i) => {
        const h = (r.value / max) * (height - 50)
        return (
          <div key={`${r.label}-${i}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="text-[11px] font-poppins font-semibold text-[#0d0d09] tabular-nums">{fmt(r.value, format, currency)}</div>
            <div
              className="w-full max-w-[40px] rounded-t-[4px] transition-[height] duration-[400ms] ease-out"
              style={{ height: h, background: PALETTE[i % PALETTE.length] }}
            />
            <div className="text-[10.5px] font-inter text-[#5A6072] truncate w-full text-center" title={r.label}>
              {r.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
