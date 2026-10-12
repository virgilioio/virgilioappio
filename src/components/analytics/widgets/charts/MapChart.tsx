import { useMemo } from 'react'
import DottedMap from 'dotted-map'
import { getCoords, countryName, countryFlag } from '@/lib/countryCoords'
import type { SeriesPoint } from '../../model/types'

/**
 * Where people are (Intelligence, Find Phase 4): a dotted world map with a
 * pin per country sized by people, and the top countries beside it. The
 * list is the control: picking a country filters the page.
 */
interface Props {
  data: SeriesPoint[]
  selected?: string[]
  onSelect?: (label: string) => void
}

const PIN = '#6F3FF5'
const PIN_DIM = '#C4B0FA'
const LAND = '#DCD5F7'

export function MapChart({ data, selected = [], onSelect }: Props) {
  const total = data.reduce((s, r) => s + r.value, 0)
  const max = Math.max(1, ...data.map(r => r.value))
  const top = data.slice(0, 6)
  const unplaced = data.filter(r => !getCoords(r.label)).length

  // dotted-map builds a plain SVG string from our own numbers; nothing from
  // a person is interpolated except country names it never renders.
  const svg = useMemo(() => {
    const map = new DottedMap({ height: 60, grid: 'diagonal' })
    for (const r of data) {
      const c = getCoords(r.label)
      if (!c) continue
      const on = selected.length === 0 || selected.includes(r.label)
      map.addPin({
        lat: c[1],
        lng: c[0],
        svgOptions: { color: on ? PIN : PIN_DIM, radius: 0.45 + (r.value / max) * 0.85 },
      })
    }
    return map.getSVG({ radius: 0.22, color: LAND, shape: 'circle', backgroundColor: 'transparent' })
  }, [data, max, selected])

  return (
    <div className="flex flex-wrap items-start gap-4 w-full min-w-0">
      <div
        className="flex-[3_1_300px] min-w-0 rounded-[10px] bg-[#FAFAF7] p-2 [&_svg]:w-full [&_svg]:h-auto"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="flex-[2_1_180px] min-w-0 flex flex-col gap-1.5">
        {top.map(r => {
          const on = selected.includes(r.label)
          const flag = countryFlag(r.label)
          const Row = onSelect ? 'button' : 'div'
          const share = total > 0 ? Math.round((r.value / total) * 100) : 0
          return (
            <Row
              key={r.label}
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(r.label), 'aria-pressed': on, 'aria-label': `${countryName(r.label)}: ${r.value} people, ${share}%` } : {})}
              className={`w-full text-left rounded-[8px] px-2 py-1.5 transition-colors duration-150 ${on ? 'bg-[#F5F0FF]' : onSelect ? 'hover:bg-[#FAFAF7]' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 text-center text-[13px] leading-none flex-shrink-0" aria-hidden="true">{flag ?? ''}</span>
                <span className="flex-1 truncate text-[12px] font-inter text-[#1F2230]">{countryName(r.label)}</span>
                <span className="font-poppins font-semibold text-[12px] tabular-nums text-[#0d0d09]">{r.value.toLocaleString('en-US')}</span>
                <span className="w-9 text-right text-[11px] font-inter tabular-nums text-[#6B7080]">{share}%</span>
              </div>
              <div className="mt-1 ml-7 h-1 rounded-full bg-[#F4F3EF] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${share}%`, background: PIN }} />
              </div>
            </Row>
          )
        })}
        {data.length > top.length && (
          <div className="px-2 text-[11px] font-inter text-[#6B7080]">
            {data.length - top.length} more {data.length - top.length === 1 ? 'country' : 'countries'}
            {unplaced > 0 ? ` · ${unplaced} not on the map` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
