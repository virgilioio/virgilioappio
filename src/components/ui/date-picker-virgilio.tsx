import { useState, useMemo } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerVirgilioProps {
  value?: Date
  onChange: (date: Date) => void
  placeholder?: string
  disabled?: (date: Date) => boolean
  className?: string
  minDate?: Date
}

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function DatePickerVirgilio({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
  minDate
}: DatePickerVirgilioProps) {
  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(value || new Date()))

  const handleDateSelect = (date: Date) => {
    onChange(date)
    setOpen(false)
  }

  // Calendar calculations
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const isDateDisabled = (date: Date) => {
    if (disabled?.(date)) return true
    if (minDate && isBefore(date, startOfDay(minDate))) return true
    return false
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "justify-start text-left font-normal border-virgilio-border",
            "hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 transition-all duration-200",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-virgilio-muted" />
          <span className="text-sm">{value ? format(value, 'MMM d, yyyy') : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 pointer-events-auto" align="start">
        <div className="space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-virgilio-text">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="h-7 w-7 p-0 hover:bg-virgilio-border/50 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4 text-virgilio-text" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="h-7 w-7 p-0 hover:bg-virgilio-border/50 rounded-lg"
              >
                <ChevronRight className="h-4 w-4 text-virgilio-text" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-1">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-virgilio-muted py-1 w-8"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Date Cells */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = value ? isSameDay(day, value) : false
                const isDisabledDate = isDateDisabled(day)
                const isTodayDate = isToday(day)

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => !isDisabledDate && isCurrentMonth && handleDateSelect(day)}
                    disabled={isDisabledDate || !isCurrentMonth}
                    className={cn(
                      "h-8 w-8 rounded-lg text-xs font-semibold transition-all duration-200 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-1",
                      !isCurrentMonth && "text-virgilio-border cursor-default",
                      isDisabledDate && isCurrentMonth && "opacity-30 cursor-not-allowed",
                      isCurrentMonth && !isDisabledDate && !isSelected && "text-virgilio-text hover:bg-virgilio-purple/10 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer",
                      isSelected && "bg-virgilio-purple text-white shadow-md",
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
}
