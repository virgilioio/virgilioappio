import * as React from 'react'
import { Link } from 'react-router-dom'
import DottedMap from 'dotted-map'
import { ChevronLeft, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { countryFlag, countryName, getCoords } from '@/lib/countryCoords'
import { DOTTED_MAP_ISO3 } from '@/lib/mapIso3'
import { motionToken } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { PeoplePlace, PlacePerson } from '@/lib/os/calendar'

/**
 * Where people live (People & Access dashboard, Allan 2026-10-26): the dotted
 * world with a pin per country, each with a tooltip of its cities; a country
 * (its pin or its row) zooms into a dotted map of that country with a pin per
 * city, where a pin's tooltip names the city and the people, and a click lists
 * them with links to their profiles. "‹ World" goes back. The zoom grows from
 * the pin that was clicked (scale + opacity, §2 dialog timing; opacity only
 * with reduced motion).
 */

const PIN = '#6F3FF5'
const LAND = '#DCD5F7'
const LAND_COUNTRY = '#CFC4F5'

interface Pin {
  key: string
  x: number // 0-100, % of the map's width
  y: number // 0-100, % of the map's height
  size: number // px
}

interface CityPin extends Pin {
  places: PeoplePlace[]
  people: number
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Pin size from a count: 10px for one person, up to 24px for the most. */
const pinSize = (n: number, max: number) => 10 + Math.round((Math.sqrt(n) / Math.sqrt(Math.max(1, max))) * 14)

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

const cityLabel = (p: PeoplePlace) => [p.city, p.region].filter(Boolean).join(', ')

export function PeopleMap({ byCountry, places }: { byCountry: { country_code: string; people: number }[]; places: PeoplePlace[] }) {
  const [country, setCountry] = React.useState<string | null>(null)
  const origin = React.useRef<{ x: number; y: number } | null>(null)
  const stage = React.useRef<HTMLDivElement>(null)

  const total = byCountry.reduce((s, c) => s + c.people, 0)
  const max = Math.max(1, ...byCountry.map((c) => c.people))

  // The world: built once per data set; dotted-map only receives our numbers.
  const world = React.useMemo(() => {
    const map = new DottedMap({ height: 60, grid: 'diagonal' })
    const pins: (Pin & { code: string })[] = []
    for (const c of byCountry) {
      const at = getCoords(c.country_code)
      if (!at) continue
      const p = map.addPin({ lat: at[1], lng: at[0], svgOptions: { color: 'transparent', radius: 0 } })
      pins.push({
        key: c.country_code,
        code: c.country_code,
        x: (p.x / map.image.width) * 100,
        y: (p.y / map.image.height) * 100,
        size: pinSize(c.people, max),
      })
    }
    const svg = map.getSVG({ radius: 0.22, color: LAND, shape: 'circle', backgroundColor: 'transparent' })
    return { svg, pins, ratio: map.image.width / map.image.height }
  }, [byCountry, max])

  // One country: its own dotted shape, city pins merged where they share a dot.
  const zoomed = React.useMemo(() => {
    if (!country) return null
    const iso3 = DOTTED_MAP_ISO3[country]
    const here = places.filter((p) => p.country_code === country)
    const located = here.filter((p) => p.lat != null && p.lng != null)
    if (!iso3) return { svg: null, pins: [] as CityPin[], here, ratio: 1 }
    const map = new DottedMap({ height: 60, grid: 'diagonal', countries: [iso3] })
    // Cities a few dots apart (Monterrey and San Pedro) share one pin, so pins never overlap.
    const pins: (CityPin & { mx: number; my: number })[] = []
    for (const p of [...located].sort((a, b) => b.people.length - a.people.length)) {
      const at = map.addPin({ lat: p.lat as number, lng: p.lng as number, svgOptions: { color: 'transparent', radius: 0 } })
      const near = pins.find((q) => Math.hypot(q.mx - at.x, q.my - at.y) < 3.5)
      if (near) {
        near.places.push(p)
        near.people += p.people.length
        continue
      }
      pins.push({ key: `${p.city}:${p.region}`, mx: at.x, my: at.y, x: (at.x / map.image.width) * 100, y: (at.y / map.image.height) * 100, size: 0, places: [p], people: p.people.length })
    }
    const most = Math.max(1, ...pins.map((p) => p.people))
    for (const p of pins) p.size = pinSize(p.people, most)
    pins.sort((a, b) => b.people - a.people)
    const svg = map.getSVG({ radius: 0.3, color: LAND_COUNTRY, shape: 'circle', backgroundColor: 'transparent' })
    return { svg, pins, here, ratio: map.image.width / map.image.height }
  }, [country, places])

  // The zoom: the new view grows from the pin that was clicked.
  React.useLayoutEffect(() => {
    const el = stage.current
    if (!el || !origin.current) return
    const o = origin.current
    origin.current = null
    el.style.transformOrigin = `${o.x}% ${o.y}%`
    el.animate(
      reduced()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: 'scale(0.92)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
      { duration: motionToken('--dur-dialog-in', 220), easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    )
  }, [country])

  const open = (code: string, at?: { x: number; y: number }) => {
    origin.current = at ?? world.pins.find((p) => p.code === code) ?? { x: 50, y: 50 }
    setCountry(code)
  }
  const back = () => {
    origin.current = world.pins.find((p) => p.code === country) ?? { x: 50, y: 50 }
    setCountry(null)
  }

  const citiesOf = (code: string) => places.filter((p) => p.country_code === code && p.city)

  return (
    <div className="flex w-full min-w-0 flex-wrap items-start gap-4">
      {/* Map */}
      <div className="min-w-0 flex-[3_1_300px] overflow-hidden rounded-[10px] bg-[#FAFAF7] p-2">
        {country && (
          <div className="mb-1 flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={back} className="-ml-1">
              World
            </Button>
            <span className="min-w-0 truncate font-inter text-[12.5px] font-medium text-[#1F2230]">
              <span aria-hidden className="mr-1">{countryFlag(country) ?? ''}</span>
              {countryName(country)}
            </span>
          </div>
        )}
        <div ref={stage} style={{ aspectRatio: String(world.ratio) }} className="relative flex w-full items-center justify-center">
          {!country ? (
            <MapLayer svg={world.svg} ratio={world.ratio}>
              {world.pins.map((p) => (
                <CountryPin
                  key={p.key}
                  pin={p}
                  code={p.code}
                  people={byCountry.find((c) => c.country_code === p.code)?.people ?? 0}
                  cities={citiesOf(p.code)}
                  onOpen={() => open(p.code, p)}
                />
              ))}
            </MapLayer>
          ) : zoomed?.svg ? (
            <MapLayer svg={zoomed.svg} ratio={zoomed.ratio} fit={world.ratio}>
              {zoomed.pins.map((p) => (
                <CityPinButton key={p.key} pin={p} />
              ))}
            </MapLayer>
          ) : (
            <p className="px-6 text-center font-inter text-[12.5px] text-[#6B7080]">
              {countryName(country)} is too small for the dotted map. Its cities are listed beside it.
            </p>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex max-h-[360px] min-w-0 flex-[2_1_180px] flex-col gap-1.5 overflow-y-auto">
        {!country ? (
          <>
            {byCountry.map((c) => {
              const share = total > 0 ? Math.round((c.people / total) * 100) : 0
              return (
                <button
                  key={c.country_code}
                  type="button"
                  onClick={() => open(c.country_code)}
                  aria-label={`${countryName(c.country_code)}: ${plural(c.people, 'person', 'people')}. Show its cities`}
                  className="w-full rounded-[8px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-[#FAFAF7]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-5 flex-shrink-0 text-center text-[13px] leading-none" aria-hidden>
                      {countryFlag(c.country_code) ?? ''}
                    </span>
                    <span className="flex-1 truncate font-inter text-[12px] text-[#1F2230]">{countryName(c.country_code)}</span>
                    <span className="font-poppins text-[12px] font-semibold tabular-nums text-[#0d0d09]">{c.people.toLocaleString('en-US')}</span>
                    <span className="w-9 text-right font-inter text-[11px] tabular-nums text-[#6B7080]">{share}%</span>
                  </div>
                  <div className="ml-7 mt-1 h-1 overflow-hidden rounded-full bg-[#F4F3EF]">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: PIN }} />
                  </div>
                </button>
              )
            })}
            <p className="px-2 font-inter text-[11px] text-[#6B7080]">Pick a country to see its cities.</p>
          </>
        ) : (
          <CityList code={country} places={zoomed?.here ?? []} />
        )}
      </div>
    </div>
  )
}

/** The dotted picture with its pins laid over it, at the map's own shape (centred in the world's box when narrower). */
function MapLayer({ svg, ratio, fit, children }: { svg: string; ratio: number; fit?: number; children: React.ReactNode }) {
  const wide = !fit || ratio >= fit
  return (
    <div
      className={cn('relative', wide ? 'w-full' : 'h-full')}
      style={{ aspectRatio: String(ratio) }}
    >
      <div aria-hidden className="absolute inset-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      {children}
    </div>
  )
}

function Dot({ size, className }: { size: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block rounded-full ring-2 ring-white/80 transition-transform duration-150 group-hover:scale-110', className)}
      style={{ width: size, height: size, background: PIN, opacity: 0.9 }}
    />
  )
}

function CountryPin({
  pin,
  code,
  people,
  cities,
  onOpen,
}: {
  pin: Pin
  code: string
  people: number
  cities: PeoplePlace[]
  onOpen: () => void
}) {
  const top = [...cities].sort((a, b) => b.people.length - a.people.length).slice(0, 4)
  const more = cities.length - top.length
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${countryName(code)}: ${plural(people, 'person', 'people')}. Show its cities`}
          className="group absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
        >
          <Dot size={pin.size} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] px-3 py-2">
        <div className="font-inter text-[12.5px] font-semibold text-[#0d0d09]">
          <span aria-hidden className="mr-1">{countryFlag(code) ?? ''}</span>
          {countryName(code)} · {plural(people, 'person', 'people')}
        </div>
        {top.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {top.map((c) => (
              <li key={cityLabel(c)} className="flex justify-between gap-3 font-inter text-[12px] text-[#5A6072]">
                <span className="truncate">{c.city}</span>
                <span className="tabular-nums">{c.people.length}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1 font-inter text-[11px] text-[#8B8F9E]">
          {more > 0 ? `${plural(more, 'more city', 'more cities')} · ` : ''}Click to zoom in
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function People({ people }: { people: PlacePerson[] }) {
  return (
    <ul className="space-y-0.5">
      {people.map((p) => (
        <li key={p.user_id}>
          <Link
            to={`/os/people/${p.member_id}`}
            className="font-inter text-[12.5px] text-[#1F2230] underline-offset-2 hover:text-[#6F3FF5] hover:underline"
          >
            {p.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function CityPinButton({ pin }: { pin: CityPin }) {
  const title = pin.places.map((p) => p.city).join(' · ')
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${title}: ${plural(pin.people, 'person', 'people')}`}
              className="group absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            >
              <Dot size={pin.size} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] px-3 py-2">
          {pin.places.map((p) => (
            <div key={cityLabel(p)} className="[&+&]:mt-1.5">
              <div className="font-inter text-[12.5px] font-semibold text-[#0d0d09]">
                {cityLabel(p)} · {plural(p.people.length, 'person', 'people')}
              </div>
              <div className="font-inter text-[12px] text-[#5A6072]">
                {p.people.slice(0, 5).map((x) => x.name).join(', ')}
                {p.people.length > 5 ? ` and ${p.people.length - 5} more` : ''}
              </div>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="center" className="w-[260px] p-3">
        {pin.places.map((p) => (
          <div key={cityLabel(p)} className="[&+&]:mt-3">
            <div className="mb-1 flex items-center gap-1.5 font-inter text-[12.5px] font-semibold text-[#0d0d09]">
              <MapPin className="h-3.5 w-3.5 text-[#6F3FF5]" strokeWidth={2} aria-hidden />
              {cityLabel(p)}
            </div>
            <People people={p.people} />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/** The zoomed country's cities, most people first, with who lives there; then those it can't place. */
function CityList({ code, places }: { code: string; places: PeoplePlace[] }) {
  const listed = places.filter((p) => p.city).sort((a, b) => b.people.length - a.people.length)
  const placed = listed.filter((p) => p.lat != null)
  const unplaced = listed.filter((p) => p.lat == null)
  const noCity = places.filter((p) => !p.city).reduce((s, p) => s + p.people.length, 0)
  return (
    <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
      {placed.map((p) => (
        <div key={cityLabel(p)} className="rounded-[8px] px-2 py-1.5">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-inter text-[12.5px] font-medium text-[#1F2230]">{cityLabel(p)}</span>
            <span className="font-poppins text-[12px] font-semibold tabular-nums text-[#0d0d09]">{p.people.length}</span>
          </div>
          <div className="mt-1">
            <People people={p.people} />
          </div>
        </div>
      ))}
      {unplaced.length > 0 && (
        <div className="px-2 font-inter text-[11.5px] text-[#6B7080]">
          Not on the map: {unplaced.map((p) => `${p.city} (${p.people.map((x) => x.name).join(', ')})`).join('; ')}.
        </div>
      )}
      {noCity > 0 && (
        <div className="px-2 font-inter text-[11.5px] text-[#6B7080]">
          {plural(noCity, 'person', 'people')} in {countryName(code)} {noCity === 1 ? 'hasn’t' : 'haven’t'} added a city.
        </div>
      )}
      {placed.length === 0 && unplaced.length === 0 && noCity === 0 && (
        <div className="px-2 font-inter text-[12px] text-[#6B7080]">Nobody here yet.</div>
      )}
    </div>
  )
}
