import { fmt } from '../../model/format'
import type { SeriesPoint, Format } from '../../model/types'

interface Props {
  dimensionLabel: string
  data: SeriesPoint[]
  format: Format
  currency?: string
}

export function TableViz({ dimensionLabel, data, format, currency }: Props) {
  const total = data.reduce((s, r) => s + r.value, 0)
  return (
    <div className="w-full overflow-hidden rounded-[8px] border border-[#F1F0EC]">
      <div className="grid grid-cols-[1fr_64px_1fr_44px] gap-3 px-3 py-2 bg-[#FAFAF7] text-[10.5px] font-inter font-medium uppercase tracking-[0.06em] text-[#8B8F9E]">
        <div>{dimensionLabel}</div>
        <div className="text-right">Value</div>
        <div>Share</div>
        <div className="text-right">%</div>
      </div>
      <div className="divide-y divide-[#F1F0EC] max-h-[260px] overflow-auto">
        {data.length === 0 && (
          <div className="px-3 py-4 text-[12px] text-[#8B8F9E] font-inter">No data</div>
        )}
        {data.map((r, i) => {
          const pct = total > 0 ? Math.round((r.value / total) * 100) : 0
          return (
            <div key={`${r.label}-${i}`} className="grid grid-cols-[1fr_64px_1fr_44px] gap-3 px-3 py-1.5 items-center text-[12px] font-inter text-[#1F2230]">
              <div className="truncate" title={r.label}>{r.label}</div>
              <div className="text-right font-poppins font-semibold tabular-nums text-[#0d0d09]">{fmt(r.value, format, currency)}</div>
              <div className="h-1.5 rounded-full bg-[#F4F3EF] overflow-hidden">
                <div className="h-full rounded-full bg-[#6F3FF5]" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-right tabular-nums text-[#5A6072]">{pct}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
