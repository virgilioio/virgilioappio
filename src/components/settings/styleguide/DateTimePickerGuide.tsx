import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { TimePickerVirgilio } from '@/components/ui/time-picker-virgilio'
import { DateTimePickerVirgilio } from '@/components/ui/datetime-picker-virgilio'
import { addDays } from 'date-fns'

export function DateTimePickerGuide() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedTime, setSelectedTime] = useState('09:00')
  const [selectedDateTime, setSelectedDateTime] = useState(new Date())

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-heading font-semibold mb-1">
          Date & Time Pickers<span className="text-primary">.</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Virgilio-styled date and time selection components with consistent design language.
        </p>
      </div>

      {/* Date Picker Section */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Date Picker</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Custom calendar with hover animations, today indicator, and selected state styling.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Default</Label>
            <DatePickerVirgilio
              value={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              className="w-[200px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">With min date (today)</Label>
            <DatePickerVirgilio
              value={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              minDate={new Date()}
              className="w-[200px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Empty state</Label>
            <DatePickerVirgilio
              value={undefined}
              onChange={(date) => setSelectedDate(date)}
              placeholder="Select a date..."
              className="w-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Time Picker Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Time Picker</h4>
          <p className="text-xs text-muted-foreground mb-3">
            15-minute intervals organized by Morning, Afternoon, and Evening groups.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Default (15-min intervals)</Label>
            <TimePickerVirgilio
              value={selectedTime}
              onChange={setSelectedTime}
              className="w-[130px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">30-minute intervals</Label>
            <TimePickerVirgilio
              value={selectedTime}
              onChange={setSelectedTime}
              intervalMinutes={30}
              className="w-[130px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Custom hours (9 AM - 6 PM)</Label>
            <TimePickerVirgilio
              value="09:00"
              onChange={setSelectedTime}
              startHour={9}
              endHour={18}
              className="w-[130px]"
            />
          </div>
        </div>
      </div>

      {/* Combined DateTime Picker Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Combined DateTime Picker</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Date and time pickers side by side, sharing state. Ideal for scheduling features.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Scheduling (future dates only)</Label>
            <DateTimePickerVirgilio
              value={selectedDateTime}
              onChange={setSelectedDateTime}
              minDate={new Date()}
              className="w-auto"
            />
          </div>
        </div>
      </div>

      {/* Styling Specifications */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Design Tokens</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Styling specifications for consistency across the platform.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <p className="font-semibold text-foreground">Colors</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Selected: <code className="text-primary">bg-virgilio-purple</code></li>
              <li>• Hover: <code className="text-primary">bg-virgilio-purple/10</code></li>
              <li>• Border: <code className="text-primary">border-virgilio-border</code></li>
              <li>• Today ring: <code className="text-primary">ring-virgilio-purple/30</code></li>
            </ul>
          </div>
          
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <p className="font-semibold text-foreground">Animations</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Duration: <code className="text-primary">200ms ease-out</code></li>
              <li>• Hover lift: <code className="text-primary">-translate-y-0.5</code></li>
              <li>• Shadow on hover: <code className="text-primary">shadow-sm</code></li>
              <li>• Selected shadow: <code className="text-primary">shadow-md</code></li>
            </ul>
          </div>
          
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <p className="font-semibold text-foreground">Time Slots</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Default interval: <code className="text-primary">15 minutes</code></li>
              <li>• Default range: <code className="text-primary">6 AM - 10 PM</code></li>
              <li>• Groups: Morning, Afternoon, Evening</li>
              <li>• Format: <code className="text-primary">12-hour (AM/PM)</code></li>
            </ul>
          </div>
          
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <p className="font-semibold text-foreground">Calendar</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Cell size: <code className="text-primary">h-8 w-8</code></li>
              <li>• Border radius: <code className="text-primary">rounded-lg</code></li>
              <li>• Week starts: Sunday</li>
              <li>• Outside days: Faded, non-interactive</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  )
}
