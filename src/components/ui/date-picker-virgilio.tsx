import { forwardRef, useRef, useState } from 'react'
import { useMonthSlide } from '@/lib/motion'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, addDays, isSameMonth, isSameDay, isToday, isBefore, isAfter, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { IconTip } from '@/components/ui/tooltip'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEAR_RANGE = 60

const headerSelectClass =
  "h-7 rounded-lg bg-transparent px-1.5 font-poppins text-[13px] font-semibold text-virgilio-text " +
  "hover:bg-[hsl(var(--menu-hover))] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-virgilio-purple/30 cursor-pointer appearance-none"

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

/** The quick-pick row's default: Today · Tomorrow · Next week. */
const DEFAULT_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'Next week', days: 7 },
]

function yearOptions(minDate?: Date, maxDate?: Date) {
  const now = new Date().getFullYear()
  const top = maxDate ? maxDate.getFullYear() : Math.max(now + 1, minDate ? minDate.getFullYear() : now + 1)
  const bottom = minDate ? minDate.getFullYear() : Math.min(top - YEAR_RANGE - 1, now - YEAR_RANGE)
  return Array.from({ length: top - bottom + 1 }, (_, i) => top - i)
}

interface DatePickerVirgilioProps {
  value?: Date
  onChange: (date: Date) => void
  placeholder?: string
  disabled?: (date: Date) => boolean
  className?: string
  minDate?: Date
  /** The latest day that can be picked (also the last year offered). */
  maxDate?: Date
  /** The quick-pick row: false hides it (e.g. a date of birth). */
  presets?: false | { label: string; days: number }[]
  /** Shows "Clear" in the popover; called when it's chosen. */
  onClear?: () => void
  /** The month shown when there's no value yet (default: today, kept within min/max). */
  defaultMonth?: Date
  /** Disables the whole control. */
  readOnly?: boolean
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  /** Date format on the trigger. */
  displayFormat?: string
}

/**
 * The app's date picker (§7): a popover from the trigger with a quick-pick row,
 * month and year selects, and six fixed weeks that slide toward the month you went to.
 * Use it for every date field, never a native `type="date"` input.
 */
export const DatePickerVirgilio = forwardRef<HTMLButtonElement, DatePickerVirgilioProps>(function DatePickerVirgilio(
  {
    value,
    onChange,
    placeholder = 'Pick a date',
    disabled,
    className,
    minDate,
    maxDate,
    presets,
    onClear,
    defaultMonth,
    readOnly,
    id,
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    displayFormat = 'MMM d, yyyy',
  },
  ref,
) {
  const [open, setOpen] = useState(false)
  const startMonth = () => {
    if (value) return startOfMonth(value)
    let d = defaultMonth ?? new Date()
    if (maxDate && isAfter(d, maxDate)) d = maxDate
    if (minDate && isBefore(d, minDate)) d = minDate
    return startOfMonth(d)
  }
  const [currentMonth, setCurrentMonth] = useState(startMonth)

  const handleDateSelect = (date: Date) => {
    onChange(date)
    setOpen(false)
  }

  // Calendar calculations
  const monthStart = startOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  // Always six weeks, so the popover never changes height between months (§7).
  const calendarEnd = addDays(calendarStart, 41)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const grid = useRef<HTMLDivElement>(null)
  useMonthSlide(grid, currentMonth.getFullYear() * 12 + currentMonth.getMonth())

  const isDateDisabled = (date: Date) => {
    if (disabled?.(date)) return true
    if (minDate && isBefore(date, startOfDay(minDate))) return true
    if (maxDate && isAfter(startOfDay(date), startOfDay(maxDate))) return true
    return false
  }
  const monthOutOfRange = (year: number, month: number) =>
    (minDate && isBefore(endOfMonth(new Date(year, month, 1)), startOfDay(minDate))) ||
    (maxDate && isAfter(new Date(year, month, 1), maxDate))
  // Keep the shown month inside the range when the year changes.
  const showMonth = (year: number, month: number) => {
    let d = new Date(year, month, 1)
    if (minDate && isBefore(endOfMonth(d), startOfDay(minDate))) d = startOfMonth(minDate)
    if (maxDate && isAfter(d, maxDate)) d = startOfMonth(maxDate)
    setCurrentMonth(d)
  }
  const prevDisabled = !!minDate && !isAfter(currentMonth, startOfMonth(minDate))
  const nextDisabled = !!maxDate && !isBefore(currentMonth, startOfMonth(maxDate))
  const quick = presets === false ? [] : (presets ?? DEFAULT_PRESETS).map((p) => ({ label: p.label, date: inDays(p.days) }))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setCurrentMonth(startMonth())
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          disabled={readOnly}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid || undefined}
          className={cn(
            "justify-start text-left font-normal border-virgilio-border tabular-nums",
            "hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 transition-colors duration-hover",
            "aria-[invalid=true]:border-destructive aria-[invalid=true]:hover:border-destructive",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-virgilio-muted" />
          <span className="truncate text-sm">{value ? format(value, displayFormat) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 pointer-events-auto" align="start">
        <div className="space-y-3">
          {/* Quick-pick row */}
          {(quick.length > 0 || onClear) && (
            <div className="flex gap-1">
              {quick.map(({ label, date }) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-[12.5px]"
                  onClick={() => !isDateDisabled(date) && handleDateSelect(date)}
                  disabled={isDateDisabled(date)}
                >
                  {label}
                </Button>
              ))}
              {onClear && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 px-2.5 text-[12.5px] text-text-tertiary"
                  disabled={!value}
                  onClick={() => {
                    onClear()
                    setOpen(false)
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              <select
                aria-label="Month"
                value={currentMonth.getMonth()}
                onChange={(e) => showMonth(currentMonth.getFullYear(), Number(e.target.value))}
                className={headerSelectClass}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i} disabled={!!monthOutOfRange(currentMonth.getFullYear(), i)}>
                    {format(new Date(2000, i, 1), 'MMMM')}
                  </option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={currentMonth.getFullYear()}
                onChange={(e) => showMonth(Number(e.target.value), currentMonth.getMonth())}
                className={cn(headerSelectClass, "tabular-nums")}
              >
                {yearOptions(minDate, maxDate).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-1">
              <IconTip label="Previous month">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Previous month"
                  disabled={prevDisabled}
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="h-7 w-7 p-0 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4 text-virgilio-text" />
                </Button>
              </IconTip>
              <IconTip label="Next month">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Next month"
                  disabled={nextDisabled}
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="h-7 w-7 p-0 rounded-lg"
                >
                  <ChevronRight className="h-4 w-4 text-virgilio-text" />
                </Button>
              </IconTip>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-1">
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-menu-group font-inter uppercase text-[hsl(var(--menu-group-color))] py-1 w-8"
                >
                  {day}
                </div>
              ))}
            </div>

            <div ref={grid} className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = value ? isSameDay(day, value) : false
                const isDisabledDate = isDateDisabled(day)
                const isTodayDate = isToday(day)

                return (
                  <button
                    key={idx}
                    type="button"
                    aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                    aria-pressed={isSelected || undefined}
                    onClick={() => !isDisabledDate && isCurrentMonth && handleDateSelect(day)}
                    disabled={isDisabledDate || !isCurrentMonth}
                    className={cn(
                      "h-8 w-8 rounded-lg text-[12.5px] font-medium tabular-nums transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30",
                      !isCurrentMonth && "text-virgilio-border cursor-default",
                      isDisabledDate && isCurrentMonth && "opacity-45 cursor-not-allowed",
                      isCurrentMonth && !isDisabledDate && !isSelected && "text-virgilio-text hover:bg-[hsl(var(--menu-hover))] cursor-pointer",
                      isSelected && "bg-virgilio-purple text-white",
                      isTodayDate && !isSelected && isCurrentMonth && "ring-1 ring-virgilio-purple/30"
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
})
