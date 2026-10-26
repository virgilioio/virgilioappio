import * as React from 'react'
import { Check, ChevronsUpDown, PenLine, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { COUNTRIES } from '@/constants/countries'
import { cn } from '@/lib/utils'
import { countryCodeFor, countryName, foldPlace, placeChange, regionByName, useCitySearch, useDebounced, useRegions, type PlaceValue } from '@/lib/places'

/**
 * Country → State or province → City (Allan, 2026-10-26). Three comboboxes
 * that share one look (the SearchableSelect trigger, a §19 list): the state
 * list is the country's own, the city list searches GeoNames' cities of
 * 5,000+ people in that country (and state) as you type, biggest first. A
 * place that isn't listed is kept as typed ("Use 'Villa de Leyva'"). Values
 * stay text, so callers store them as they always have.
 */

const COUNTRY_ROWS = COUNTRIES.filter((c) => c.value !== 'OTHER')

interface TriggerProps {
  id?: string
  open: boolean
  label: string
  placeholder: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

const Trigger = React.forwardRef<HTMLButtonElement, TriggerProps & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ id, open, label, placeholder, disabled, invalid, className, ...rest }, ref) => (
    <Button
      ref={ref}
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      className={cn('h-11 w-full justify-between rounded-lg px-3 font-inter text-base font-normal sm:text-sm', !label && 'text-text-tertiary', className)}
      {...rest}
    >
      <span className="min-w-0 truncate">{label || placeholder}</span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
    </Button>
  ),
)
Trigger.displayName = 'PlaceTrigger'

function Tick({ on }: { on: boolean }) {
  return <span className="gio-mrow-check">{on && <Check className="h-4 w-4" strokeWidth={2} aria-hidden />}</span>
}

/** "Use 'what you typed'": keeps a place that isn't listed. */
function UseTyped({ text, onPick }: { text: string; onPick: () => void }) {
  return (
    <CommandItem value={`__use__${text}`} onSelect={onPick}>
      <PenLine aria-hidden />
      <span className="truncate">
        Use “{text}”
      </span>
    </CommandItem>
  )
}

function ClearRow({ onPick }: { onPick: () => void }) {
  return (
    <CommandItem value="__clear__" onSelect={onPick}>
      <X aria-hidden />
      <span className="truncate">Clear</span>
    </CommandItem>
  )
}

/** A line under the list (no row): what's searched, or why nothing is. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1.5 font-inter text-[12px] leading-[1.4] text-[hsl(var(--menu-group-color))]">{children}</p>
}

const panelClass = 'w-[--radix-popover-trigger-width] min-w-[240px] max-w-[min(360px,calc(100vw-24px))] p-0'

/* ── Country ─────────────────────────────────────────────────────────────── */

export function CountryPicker({
  id,
  value,
  onChange,
  placeholder = 'Choose a country',
  disabled,
  className,
}: {
  id?: string
  /** ISO code. */
  value: string
  onChange: (code: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const f = foldPlace(q)
  const rows = f ? COUNTRY_ROWS.filter((c) => foldPlace(c.label).split(/[\s-]+/).some((w) => w.startsWith(f)) || foldPlace(c.label).startsWith(f)) : COUNTRY_ROWS
  const pick = (code: string) => {
    onChange(code)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setQ(''))} modal>
      <PopoverTrigger asChild>
        <Trigger id={id} open={open} label={countryName(value)} placeholder={placeholder} disabled={disabled} className={className} />
      </PopoverTrigger>
      <PopoverContent className={panelClass} align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search countries…" value={q} onValueChange={setQ} />
          <CommandList>
            {value && !f && (
              <>
                <CommandGroup>
                  <ClearRow onPick={() => pick('')} />
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup>
              {rows.map((c) => (
                <CommandItem key={c.value} value={c.value} onSelect={() => pick(c.value)}>
                  <span className="truncate">{c.label}</span>
                  <Tick on={value === c.value} />
                </CommandItem>
              ))}
            </CommandGroup>
            {!rows.length && <Note>No country by that name.</Note>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ── State or province ───────────────────────────────────────────────────── */

export function RegionPicker({
  id,
  countryCode,
  value,
  onChange,
  placeholder = 'Choose a state or province',
  disabled,
  className,
}: {
  id?: string
  countryCode: string
  /** The state's name, as stored. */
  value: string
  onChange: (name: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const regions = useRegions(countryCode)
  const list = regions.data ?? []
  const chosen = regionByName(list, value)
  const f = foldPlace(q)
  const rows = f ? list.filter((r) => foldPlace(r.name).split(/[\s-]+/).some((w) => w.startsWith(f)) || foldPlace(r.name).startsWith(f)) : list
  const exact = !!f && list.some((r) => foldPlace(r.name) === f)
  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setQ(''))} modal>
      <PopoverTrigger asChild>
        <Trigger id={id} open={open} label={chosen?.name ?? value} placeholder={placeholder} disabled={disabled} className={className} />
      </PopoverTrigger>
      <PopoverContent className={panelClass} align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search states and provinces…" value={q} onValueChange={setQ} loading={regions.isFetching} />
          <CommandList>
            {value && !f && (
              <>
                <CommandGroup>
                  <ClearRow onPick={() => pick('')} />
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {rows.length > 0 && (
              <CommandGroup>
                {rows.map((r) => (
                  <CommandItem key={r.code} value={`r-${r.code}`} onSelect={() => pick(r.name)}>
                    <span className="truncate">{r.name}</span>
                    <Tick on={chosen?.code === r.code} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {f && !exact && (
              <CommandGroup>
                <UseTyped text={q.trim()} onPick={() => pick(q.trim())} />
              </CommandGroup>
            )}
            {!countryCode ? (
              <Note>Choose a country to see its states and provinces, or type one.</Note>
            ) : regions.isError ? (
              <Note>Couldn't load the list. Type the name instead.</Note>
            ) : regions.isSuccess && !rows.length ? (
              <Note>{f ? 'Not on the list. You can keep it as typed.' : 'No states or provinces listed. Type one if you need it.'}</Note>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ── City ────────────────────────────────────────────────────────────────── */

export function CityPicker({
  id,
  countryCode,
  regionName,
  value,
  onChange,
  placeholder = 'Choose a city',
  disabled,
  className,
}: {
  id?: string
  countryCode: string
  /** Narrows the list to this state, when it's one we know. */
  regionName?: string
  value: string
  /** The city, and its state when it came from the list. */
  onChange: (city: string, regionName?: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const regions = useRegions(countryCode)
  const region = regionByName(regions.data, regionName)
  const debounced = useDebounced(q)
  // Wait for the state list when a state is set, so the first search is already narrowed.
  const ready = open && (!regionName || !regions.isLoading)
  const cities = useCitySearch(countryCode, region?.code ?? null, debounced, ready)
  const typed = q.trim()
  const settled = foldPlace(debounced) === foldPlace(q)
  const rows = cities.data ?? []
  const exact = !!typed && rows.some((c) => foldPlace(c.name) === foldPlace(typed))
  const pick = (city: string, regionOf?: string | null) => {
    onChange(city, regionOf ?? undefined)
    setOpen(false)
  }
  const where = region?.name ?? countryName(countryCode)

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || setQ(''))} modal>
      <PopoverTrigger asChild>
        <Trigger id={id} open={open} label={value} placeholder={placeholder} disabled={disabled} className={className} />
      </PopoverTrigger>
      <PopoverContent className={panelClass} align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={countryCode ? `Search cities in ${where}…` : 'Type a city…'}
            value={q}
            onValueChange={setQ}
            loading={!!countryCode && (cities.isFetching || !settled)}
          />
          <CommandList>
            {value && !typed && (
              <>
                <CommandGroup>
                  <ClearRow onPick={() => pick('')} />
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {countryCode && rows.length > 0 && (
              <CommandGroup>
                {rows.map((c) => (
                  <CommandItem key={c.id} value={`c-${c.id}`} onSelect={() => pick(c.name, c.region_name)}>
                    <span className="truncate">{c.name}</span>
                    {!region && c.region_name && <CommandShortcut>{c.region_name}</CommandShortcut>}
                    <Tick on={foldPlace(value) === foldPlace(c.name) && (!region || c.region_code === region.code)} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {typed && !exact && (
              <CommandGroup>
                <UseTyped text={typed} onPick={() => pick(typed)} />
              </CommandGroup>
            )}
            {!countryCode ? (
              <Note>Choose a country to see its cities, or type one.</Note>
            ) : cities.isError ? (
              <Note>Couldn't load cities. Type the name instead.</Note>
            ) : cities.isSuccess && settled && !rows.length ? (
              <Note>{typed ? `No city by that name in ${where}. You can keep it as typed.` : `No cities listed in ${where}.`}</Note>
            ) : null}
            {countryCode && <Note>Cities of 5,000+ people, from GeoNames.</Note>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Country, state and city for records that store the country by name (a
 * candidate's location_country, the careers form): the pickers work on its
 * code and hand back the English name. A country we can't match (an old
 * "LATAM") still shows as written until someone picks another.
 */
export function PlaceFieldsByName({
  idPrefix,
  value,
  onChange,
  fields = ['country', 'region', 'city'],
  className,
}: {
  idPrefix: string
  value: { country: string; region: string; city: string }
  onChange: (next: { country: string; region: string; city: string }) => void
  fields?: (keyof PlaceValue)[]
  className?: string
}) {
  const code = countryCodeFor(value.country)
  const asCode: PlaceValue = { country: code || value.country, region: value.region, city: value.city }
  const set = (key: keyof PlaceValue, v: string, regionOfCity?: string) => {
    const next = placeChange(asCode, key, v, regionOfCity)
    onChange({ country: key === 'country' ? countryName(next.country) : value.country, region: next.region, city: next.city })
  }
  const cols = ({ 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' } as Record<number, string>)[fields.length] ?? 'sm:grid-cols-3'
  return (
    <div className={cn('grid grid-cols-1 gap-3', cols, className)}>
      {fields.includes('country') && (
        <CountryPicker id={`${idPrefix}-country`} value={asCode.country} onChange={(v) => set('country', v)} placeholder="Country" />
      )}
      {fields.includes('region') && (
        <RegionPicker id={`${idPrefix}-region`} countryCode={code} value={value.region} onChange={(v) => set('region', v)} placeholder="State or province" />
      )}
      {fields.includes('city') && (
        <CityPicker
          id={`${idPrefix}-city`}
          countryCode={code}
          regionName={value.region}
          value={value.city}
          onChange={(v, r) => set('city', v, r)}
          placeholder="City"
        />
      )}
    </div>
  )
}
