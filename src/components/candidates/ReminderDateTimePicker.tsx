import { format } from 'date-fns'
import { DateTimePickerVirgilio } from '@/components/ui/datetime-picker-virgilio'

interface ReminderDateTimePickerProps {
  value: Date
  onChange: (date: Date) => void
}

export function ReminderDateTimePicker({ value, onChange }: ReminderDateTimePickerProps) {
  return (
    <DateTimePickerVirgilio
      value={value}
      onChange={onChange}
      minDate={new Date()}
      startHour={6}
      endHour={22}
      intervalMinutes={15}
    />
  )
}
