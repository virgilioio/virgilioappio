import { AGING_BUCKETS } from '@/hooks/analytics/usePipelineAgingMetrics'
import { useHoverTip } from './ChartHoverTip'

// Green → red aging ramp (chart palette, matches analytics tones)
const BUCKET_COLORS = ['#12B886', '#F5B83D', '#F08C3A', '#FA5252']

export function AgingChart({ data }: { data: { label: string; buckets: number[] }[] }) {
  const tip = useHoverTip()
  const rows = data.slice(0, 10)
  const max = Math.max(1, ...rows.map(r => r.buckets.reduce((s, n) => s + n, 0)))
  return (
    <div className="flex flex-col gap-2.5 py-1 w-full overflow-hidden">
      <div className="flex flex-wrap gap-3 text-[10.5px] font-inter text-[#5A6072]">
        {AGING_BUCKETS.map((b, i) => (
          <span key={b} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: BUCKET_COLORS[i] }} />
            {b}
          </span>
        ))}
      </div>
      {rows.length === 0 && <div className="text-[12px] text-[#8B8F9E] font-inter">No data</div>}
      {rows.map((r, i) => {
        const total = r.buckets.reduce((s, n) => s + n, 0)
        return (
          <div key={`${r.label}-${i}`} className="flex items-center gap-3 min-w-0">
            <div className="text-right text-[11.5px] font-inter text-[#1F2230] truncate flex-shrink-0" style={{ width: 'clamp(72px, 28%, 140px)' }} title={r.label}>
              {r.label}
            </div>
            <div className="flex-1 min-w-0 h-5 relative">
              <div className="h-full flex rounded-[4px] overflow-hidden" style={{ width: `${(total / max) * 100}%` }}>
                {r.buckets.map((n, j) =>
                  n > 0 ? (
                    <div
                      key={j}
                      className="h-full transition-opacity hover:opacity-80 cursor-default"
                      style={{ flex: n, background: BUCKET_COLORS[j] }}
                      onMouseMove={e => tip.show(e, {
                        title: r.label,
                        rows: [
                          { color: BUCKET_COLORS[j], label: `${AGING_BUCKETS[j]} days`, value: `${n} (${Math.round((n / total) * 100)}%)` },
                          { label: 'Total', value: String(total) },
                        ],
                      })}
                      onMouseLeave={tip.hide}
                    />
                  ) : null,
                )}
              </div>
            </div>
            <div className="text-right font-poppins font-semibold text-[12.5px] tabular-nums text-[#0d0d09] flex-shrink-0" style={{ width: 36 }}>
              {total}
            </div>
          </div>
        )
      })}
      {tip.node}
    </div>
  )
}
