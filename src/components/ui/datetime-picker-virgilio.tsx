import { format } from 'date-fns'
import { DatePickerVirgilio } from './date-picker-virgilio'
import { TimePickerVirgilio } from './time-picker-virgilio'
import { cn } from '@/lib/utils'

interface DateTimePickerVirgilioProps {
  value: Date
  onChange: (date: Date) => void
  className?: string
  minDate?: Date
  disabledDates?: (date: Date) => boolean
  startHour?: number
  endHour?: number
  intervalMinutes?: 15 | 30
}

export function DateTimePickerVirgilio({
  value,
  onChange,
  className,
  minDate,
  disabledDates,
  startHour = 6,
  endHour = 22,
  intervalMinutes = 15
}: DateTimePickerVirgilioProps) {
  const currentTime = format(value, 'HH:mm')

  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date)
    newDate.setHours(value.getHours())
    newDate.setMinutes(value.getMinutes())
    onChange(newDate)
  }

  const handleTimeSelect = (timeValue: string) => {
    const [hours, minutes] = timeValue.split(':').map(Number)
    const newDate = new Date(value)
    newDate.setHours(hours)
    newDate.setMinutes(minutes)
    onChange(newDate)
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <DatePickerVirgilio
        value={value}
        onChange={handleDateSelect}
        minDate={minDate}
        disabled={disabledDates}
        className="flex-1 h-9"
      />
      <TimePickerVirgilio
        value={currentTime}
        onChange={handleTimeSelect}
        startHour={startHour}
        endHour={endHour}
        intervalMinutes={intervalMinutes}
        className="w-[110px] h-9"
      />
    </div>
  )
}
