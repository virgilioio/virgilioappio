import { useEffect, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { cn } from '@/lib/utils'
import { DATE_FIELDS, chipLabel, type DateField, type DateRangeFilter } from '@/lib/candidateDates'
import { fromIsoDay, toIsoDay } from '@/lib/isoDay'

/**
 * A Date filter chip (2026-10-14): pick which date (added, applied,
 * interview…) and when (last 7/30/90 days, a year, upcoming for interviews, or
 * fixed dates). With no `value` it's the "+ Date" chip that adds a filter.
 */
const PAST = [
  { within: 7, label: 'Last 7 days' },
  { within: 30, label: 'Last 30 days' },
  { within: 90, label: 'Last 90 days' },
  { within: 365, label: 'Last 12 months' },
]
const TODAY = [{ label: 'Today', days: 0 }]
// The "Or between" pickers at the menu's compact size.
const dateCls = 'h-8 w-full rounded-md px-2.5 [&>span]:text-[12.5px] [&>svg]:mr-1.5'
const FUTURE = [
  { next: 7, label: 'Next 7 days' },
  { next: 30, label: 'Next 30 days' },
]

interface DateFilterChipProps {
  value?: DateRangeFilter
  /** Fields already used by other date chips (shown as taken). */
  usedFields?: DateField[]
  onChange: (next: DateRangeFilter) => void
  onRemove?: () => void
}

export function DateFilterChip({ value, usedFields = [], onChange, onRemove }: DateFilterChipProps) {
  const [open, setOpen] = useState(false)
  const firstFree = DATE_FIELDS.find((f) => !usedFields.includes(f.field))?.field ?? 'added'
  const [field, setField] = useState<DateField>(value?.field ?? firstFree)
  const [from, setFrom] = useState(value?.from ?? '')
  const [to, setTo] = useState(value?.to ?? '')

  useEffect(() => {
    if (!open) return
    setField(value?.field ?? firstFree)
    setFrom(value?.from ?? '')
    setTo(value?.to ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = (next: Omit<DateRangeFilter, 'field'>, close = true) => {
    onChange({ field, within: null, next: null, from: null, to: null, ...next })
    if (close) setOpen(false)
  }
  const pickField = (f: DateField) => {
    setField(f)
    // Editing an existing chip keeps its range and changes only which date.
    if (value) onChange({ ...value, field: f, next: f === 'interview' ? value.next : null })
  }
  const setCustom = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom)
    setTo(nextTo)
    if (nextFrom || nextTo) commit({ from: nextFrom || null, to: nextTo || null }, false)
  }

  const isSelected = (p: { within?: number; next?: number }) =>
    !!value && value.field === field && (p.within != null ? value.within === p.within : value.next === p.next)
  const presets = field === 'interview' ? [...PAST, ...FUTURE] : PAST

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 font-poppins font-medium transition-colors duration-150 whitespace-nowrap',
            'h-9 px-3.5 rounded-lg border border-virgilio-border text-[13px] text-text-primary',
            value ? 'bg-[#FAFAF7] hover:bg-[hsl(var(--menu-hover))]' : 'bg-white hover:bg-[#FAFAF7]',
          )}
        >
          {value ? (
            <>
              <span className="text-virgilio-purple">{chipLabel(value)}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </>
          ) : (
            <>
              <span aria-hidden className="text-[15px] leading-none text-[hsl(var(--menu-group-color))] -mt-px">+</span>
              Date
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={6} className="w-[340px] p-0 overflow-hidden">
        <div className="grid grid-cols-[150px_1fr]">
          <div className="border-r border-[hsl(var(--tbl-divider-color))] p-1.5">
            <div className="px-2 pt-1.5 pb-1 text-menu-group font-inter uppercase text-[hsl(var(--menu-group-color))]">Date</div>
            {DATE_FIELDS.map((f) => {
              const taken = f.field !== value?.field && usedFields.includes(f.field)
              const active = f.field === field
              return (
                <button
                  key={f.field}
                  type="button"
                  disabled={taken}
                  onClick={() => pickField(f.field)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 h-[var(--menu-item-h)] px-2 rounded-[var(--menu-item-radius)] text-left text-menu-item font-inter transition-colors',
                    'hover:bg-[hsl(var(--menu-hover))] disabled:opacity-40 disabled:hover:bg-transparent',
                    active && 'bg-[hsl(var(--menu-selected))]',
                  )}
                >
                  <span className="truncate">{f.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-virgilio-purple" />}
                </button>
              )
            })}
          </div>

          <div className="p-1.5 flex flex-col">
            <div className="px-2 pt-1.5 pb-1 text-menu-group font-inter uppercase text-[hsl(var(--menu-group-color))]">When</div>
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => commit('within' in p ? { within: p.within } : { next: p.next })}
                className={cn(
                  'w-full flex items-center justify-between h-[var(--menu-item-h)] px-2 rounded-[var(--menu-item-radius)] text-left text-menu-item font-inter transition-colors hover:bg-[hsl(var(--menu-hover))]',
                  isSelected(p) && 'bg-[hsl(var(--menu-selected))]',
                )}
              >
                {p.label}
                {isSelected(p) && <Check className="h-3.5 w-3.5 text-virgilio-purple" />}
              </button>
            ))}
            <div className="mt-1.5 px-2 pb-1.5 space-y-1.5">
              <div className="text-[11.5px] text-text-tertiary font-inter">Or between</div>
              <DatePickerVirgilio
                aria-label="From"
                placeholder="From"
                presets={TODAY}
                className={dateCls}
                value={fromIsoDay(from)}
                maxDate={fromIsoDay(to)}
                onChange={(d) => setCustom(toIsoDay(d), to)}
                onClear={() => setCustom('', to)}
              />
              <DatePickerVirgilio
                aria-label="To"
                placeholder="To"
                presets={TODAY}
                className={dateCls}
                value={fromIsoDay(to)}
                minDate={fromIsoDay(from)}
                onChange={(d) => setCustom(from, toIsoDay(d))}
                onClear={() => setCustom(from, '')}
              />
            </div>
          </div>
        </div>

        {value && onRemove && (
          <div className="border-t border-[hsl(var(--tbl-divider-color))] px-2 py-1.5 flex justify-start">
            <button
              type="button"
              onClick={() => { onRemove(); setOpen(false) }}
              className="h-7 px-2 rounded-md text-[12px] font-inter text-text-tertiary hover:text-text-primary hover:bg-[hsl(var(--menu-hover))] transition-colors"
            >
              Remove date filter
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
