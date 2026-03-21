import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { TimePickerVirgilio } from '@/components/ui/time-picker-virgilio'
import { addDays } from 'date-fns'

export interface ScheduleDelayValue {
  preset: string // 'tomorrow' | '2days' | '3days' | '1week' | 'custom'
  customDate?: string // ISO string
  customTime?: string // HH:mm
}

const PRESETS = [
  { value: 'tomorrow', label: 'Tomorrow morning (9:00 AM)' },
  { value: '2days', label: 'In 2 days (9:00 AM)' },
  { value: '3days', label: 'In 3 days (9:00 AM)' },
  { value: '1week', label: 'Next week (9:00 AM)' },
  { value: 'custom', label: 'Custom date & time' },
]

const PRESET_DAYS: Record<string, number> = {
  tomorrow: 1,
  '2days': 2,
  '3days': 3,
  '1week': 7,
}

export function resolveScheduleDate(value: ScheduleDelayValue): Date | undefined {
  if (!value.preset) return undefined

  if (value.preset === 'custom') {
    if (!value.customDate) return undefined
    const date = new Date(value.customDate)
    if (value.customTime) {
      const [hours, minutes] = value.customTime.split(':').map(Number)
      date.setHours(hours, minutes, 0, 0)
    } else {
      date.setHours(9, 0, 0, 0)
    }
    return date
  }

  const days = PRESET_DAYS[value.preset]
  if (!days) return undefined
  const date = addDays(new Date(), days)
  date.setHours(9, 0, 0, 0)
  return date
}

interface ScheduleDelaySelectorProps {
  value: ScheduleDelayValue
  onChange: (value: ScheduleDelayValue) => void
  className?: string
}

export function ScheduleDelaySelector({ value, onChange, className }: ScheduleDelaySelectorProps) {
  return (
    <div className={className}>
      <Select
        value={value.preset || ''}
        onValueChange={(preset) => onChange({ ...value, preset })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select when to send..." />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === 'custom' && (
        <div className="flex items-center gap-3 mt-2">
          <DatePickerVirgilio
            value={value.customDate ? new Date(value.customDate) : new Date()}
            onChange={(date) => onChange({ ...value, customDate: date.toISOString() })}
            minDate={new Date()}
            className="w-[160px]"
          />
          <TimePickerVirgilio
            value={value.customTime || '09:00'}
            onChange={(time) => onChange({ ...value, customTime: time })}
            className="w-[120px]"
          />
        </div>
      )}
    </div>
  )
}
