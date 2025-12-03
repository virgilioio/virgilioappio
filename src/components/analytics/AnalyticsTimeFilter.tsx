import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarIcon } from 'lucide-react'
import { format, subDays, subHours, startOfMonth, endOfMonth } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'

export type TimePreset = 'today' | 'last24h' | 'last7d' | 'last14d' | 'last30d' | 'last90d' | 'thisMonth' | 'custom'

interface AnalyticsTimeFilterProps {
  onDateRangeChange: (startDate: Date, endDate: Date) => void
  initialPreset?: TimePreset
}

export function AnalyticsTimeFilter({ onDateRangeChange, initialPreset = 'last7d' }: AnalyticsTimeFilterProps) {
  const [preset, setPreset] = useState<TimePreset>(initialPreset)
  const [customRange, setCustomRange] = useState<DateRange | undefined>()
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const getDateRangeForPreset = (presetValue: TimePreset): { start: Date; end: Date } => {
    const now = new Date()
    const end = now

    switch (presetValue) {
      case 'today':
        return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() }
      case 'last24h':
        return { start: subHours(now, 24), end: new Date() }
      case 'last7d':
        return { start: subDays(now, 7), end: new Date() }
      case 'last14d':
        return { start: subDays(now, 14), end: new Date() }
      case 'last30d':
        return { start: subDays(now, 30), end: new Date() }
      case 'last90d':
        return { start: subDays(now, 90), end: new Date() }
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case 'custom':
        if (customRange?.from && customRange?.to) {
          return { start: customRange.from, end: customRange.to }
        }
        return { start: subDays(now, 7), end: new Date() }
      default:
        return { start: subDays(now, 7), end: new Date() }
    }
  }

  const handlePresetChange = (value: TimePreset) => {
    setPreset(value)
    if (value !== 'custom') {
      const range = getDateRangeForPreset(value)
      onDateRangeChange(range.start, range.end)
    } else {
      setIsCalendarOpen(true)
    }
  }

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range)
    if (range?.from && range?.to) {
      onDateRangeChange(range.from, range.to)
      setIsCalendarOpen(false)
    }
  }

  const presetLabels: Record<TimePreset, string> = {
    today: 'Today',
    last24h: 'Last 24 Hours',
    last7d: 'Last 7 Days',
    last14d: 'Last 14 Days',
    last30d: 'Last 30 Days',
    last90d: 'Last 90 Days',
    thisMonth: 'This Month',
    custom: 'Custom Range'
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={preset} onValueChange={(v) => handlePresetChange(v as TimePreset)}>
        <SelectTrigger className="w-[180px] font-poppins">
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(presetLabels).map(([key, label]) => (
            <SelectItem key={key} value={key} className="font-poppins">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'justify-start text-left font-poppins',
                !customRange?.from && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customRange?.from ? (
                customRange.to ? (
                  <>
                    {format(customRange.from, 'LLL dd, y')} - {format(customRange.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(customRange.from, 'LLL dd, y')
                )
              ) : (
                'Pick a date range'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={customRange?.from}
              selected={customRange}
              onSelect={handleCustomRangeSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
