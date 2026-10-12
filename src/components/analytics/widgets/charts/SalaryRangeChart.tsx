import { TRACK } from '../../model/tokens'
import { fmt } from '../../model/format'
import { useHoverTip } from './ChartHoverTip'
import type { SalaryRange } from '../../model/types'
import { ChartMotion } from '@/components/ui/chart-motion'

/**
 * Salary range per group (Intelligence, Find Phase 4): the middle half of
 * salaries (P25–P75) as a bar, the median as a mark, and how many salaries
 * it's built from. Groups with fewer than 5 salaries never reach this chart.
 */
interface Props {
  widgetId: string
  ranges: SalaryRange[]
  currency: string
  selected?: string[]
  onSelect?: (label: string) => void
}

const BAR = '#12B886'
const BAR_TINT = '#BDEBDA'

export function SalaryRangeChart({ widgetId, ranges, currency, selected = [], onSelect }: Props) {
  const tip = useHoverTip()
  const rows = ranges.slice(0, 10)
  const max = Math.max(1, ...rows.map(r => r.p75)) * 1.04
  const money = (v: number) => fmt(v, 'money', currency)

  return (
    <ChartMotion id={`analytics:${widgetId}`} axis="x" className="flex flex-col gap-2.5 py-1 w-full overflow-hidden">
      {rows.map((r) => {
        const on = selected.includes(r.label)
        const Row = onSelect ? 'button' : 'div'
        const left = (r.p25 / max) * 100
        const width = Math.max(1.5, ((r.p75 - r.p25) / max) * 100)
        const mid = (r.median / max) * 100
        return (
          <Row
            key={r.label}
            {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(r.label), 'aria-pressed': on, 'aria-label': `${r.label}: median ${money(r.median)}, middle half ${money(r.p25)} to ${money(r.p75)}, from ${r.n} salaries` } : {})}
            className={`flex items-center gap-3 min-w-0 w-full text-left transition-opacity duration-150 ${selected.length > 0 && !on ? 'opacity-[0.45]' : ''}`}
          >
            <div
              className="text-right text-[11.5px] font-inter text-[#1F2230] truncate flex-shrink-0"
              style={{ width: 'clamp(72px, 26%, 140px)' }}
            >
              {r.label}
            </div>
            <div
              className="flex-1 min-w-0 h-5 rounded-[4px] relative overflow-hidden"
              style={{ background: TRACK }}
              onMouseMove={e => tip.show(e, {
                title: r.label,
                rows: [
                  { color: BAR, label: 'Median', value: money(r.median) },
                  { color: BAR_TINT, label: 'Middle half', value: `${money(r.p25)}–${money(r.p75)}` },
                  { label: 'Salaries', value: r.n.toLocaleString('en-US') },
                ],
              })}
              onMouseLeave={tip.hide}
            >
              <div
                data-chart-bar={r.label}
                className="absolute top-0 h-full rounded-[4px]"
                style={{ left: `${left}%`, width: `${width}%`, background: BAR_TINT }}
              />
              <div
                className="absolute top-[2px] bottom-[2px] w-[3px] rounded-full"
                style={{ left: `calc(${mid}% - 1.5px)`, background: BAR }}
              />
            </div>
            <div className="flex-shrink-0 text-right" style={{ width: 'clamp(64px, 20%, 96px)' }}>
              <div className="font-poppins font-semibold text-[12.5px] tabular-nums text-[#0d0d09] truncate">{money(r.median)}</div>
              <div className="text-[10.5px] font-inter tabular-nums text-[#6B7080]">{r.n} salaries</div>
            </div>
          </Row>
        )
      })}
      {tip.node}
    </ChartMotion>
  )
}
