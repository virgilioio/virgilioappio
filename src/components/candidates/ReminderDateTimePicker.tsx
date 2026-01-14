import { useState, useMemo } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReminderDateTimePickerProps {
  value: Date
  onChange: (date: Date) => void
}

// Generate time slots from 6:00 AM to 10:00 PM in 15-minute increments
function generateTimeSlots() {
  const slots: { value: string; label: string; hour: number }[] = []
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const label = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
      slots.push({ value, label, hour })
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

export function ReminderDateTimePicker({ value, onChange }: ReminderDateTimePickerProps) {
  const [dateOpen, setDateOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(value))

  const selectedTime = format(value, 'HH:mm')
  const selectedHour = value.getHours()

  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date)
    newDate.setHours(value.getHours())
    newDate.setMinutes(value.getMinutes())
    onChange(newDate)
    setDateOpen(false)
  }

  const handleTimeSelect = (timeValue: string) => {
    const [hours, minutes] = timeValue.split(':').map(Number)
    const newDate = new Date(value)
    newDate.setHours(hours)
    newDate.setMinutes(minutes)
    onChange(newDate)
    setTimeOpen(false)
  }

  // Calendar calculations
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  // Group time slots
  const morningSlots = TIME_SLOTS.filter(s => s.hour < 12)
  const afternoonSlots = TIME_SLOTS.filter(s => s.hour >= 12 && s.hour < 17)
  const eveningSlots = TIME_SLOTS.filter(s => s.hour >= 17)

  const renderTimeGroup = (slots: typeof TIME_SLOTS, label: string) => {
    if (slots.length === 0) return null
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-virgilio-muted uppercase tracking-wide px-1">
          {label}
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((slot) => {
            const isSelected = selectedTime === slot.value
            return (
              <Button
                key={slot.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTimeSelect(slot.value)}
                className={cn(
                  "h-8 text-xs font-medium border-virgilio-border rounded-lg transition-all duration-200 ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2",
                  isSelected
                    ? "bg-virgilio-purple text-white border-virgilio-purple shadow-md"
                    : "bg-white text-virgilio-text hover:bg-virgilio-purple/10 hover:-translate-y-0.5 hover:shadow-sm hover:border-virgilio-purple/50"
                )}
              >
                {slot.label}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      {/* Date Picker */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "flex-1 h-9 justify-start text-left font-normal border-virgilio-border",
              "hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 transition-all duration-200"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-virgilio-muted" />
            <span className="text-sm">{format(value, 'MMM d, yyyy')}</span>
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
                {weekDays.map((day) => (
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
                  const isSelected = isSameDay(day, value)
                  const isPast = isBefore(day, startOfDay(new Date()))
                  const isTodayDate = isToday(day)
                  const isDisabled = !isCurrentMonth || isPast

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => !isDisabled && handleDateSelect(day)}
                      disabled={isDisabled}
                      className={cn(
                        "h-8 w-8 rounded-lg text-xs font-semibold transition-all duration-200 ease-out",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-1",
                        !isCurrentMonth && "text-virgilio-border cursor-default",
                        isPast && isCurrentMonth && "opacity-30 cursor-not-allowed",
                        isCurrentMonth && !isPast && !isSelected && "text-virgilio-text hover:bg-virgilio-purple/10 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer",
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

      {/* Time Picker */}
      <Popover open={timeOpen} onOpenChange={setTimeOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-[110px] h-9 justify-start text-left font-normal border-virgilio-border",
              "hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 transition-all duration-200"
            )}
          >
            <Clock className="mr-2 h-4 w-4 text-virgilio-muted" />
            <span className="text-sm">{format(value, 'h:mm a')}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-4 pointer-events-auto" align="start">
          <ScrollArea className="h-[300px] pr-3">
            <div className="space-y-4">
              {renderTimeGroup(morningSlots, 'Morning')}
              {renderTimeGroup(afternoonSlots, 'Afternoon')}
              {renderTimeGroup(eveningSlots, 'Evening')}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}
