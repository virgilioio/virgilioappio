import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimePickerVirgilioProps {
  value: string // HH:mm format
  onChange: (time: string) => void
  className?: string
  startHour?: number
  endHour?: number
  intervalMinutes?: 15 | 30
}

interface TimeSlot {
  value: string
  label: string
  hour: number
}

function generateTimeSlots(startHour: number, endHour: number, intervalMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const label = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
      slots.push({ value, label, hour })
    }
  }
  return slots
}

function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function TimePickerVirgilio({
  value,
  onChange,
  className,
  startHour = 6,
  endHour = 22,
  intervalMinutes = 15
}: TimePickerVirgilioProps) {
  const [open, setOpen] = useState(false)

  const timeSlots = useMemo(
    () => generateTimeSlots(startHour, endHour, intervalMinutes),
    [startHour, endHour, intervalMinutes]
  )

  const morningSlots = timeSlots.filter(s => s.hour < 12)
  const afternoonSlots = timeSlots.filter(s => s.hour >= 12 && s.hour < 17)
  const eveningSlots = timeSlots.filter(s => s.hour >= 17)

  const handleTimeSelect = (timeValue: string) => {
    onChange(timeValue)
    setOpen(false)
  }

  const renderTimeGroup = (slots: TimeSlot[], label: string) => {
    if (slots.length === 0) return null
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-virgilio-muted uppercase tracking-wide px-1">
          {label}
        </h4>
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((slot) => {
            const isSelected = value === slot.value
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "justify-start text-left font-normal border-virgilio-border",
            "hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 transition-all duration-200",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 text-virgilio-muted" />
          <span className="text-sm">{formatTimeDisplay(value)}</span>
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
  )
}
