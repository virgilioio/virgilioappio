
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, addMonths, subMonths } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const headerSelectClass =
  "h-7 rounded-lg bg-transparent px-1.5 font-poppins text-[13px] font-semibold text-virgilio-text " +
  "hover:bg-[hsl(var(--menu-hover))] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-virgilio-purple/30 cursor-pointer appearance-none"

interface MonthPickerProps {
  selected?: Date
  onSelect: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function MonthPicker({ selected, onSelect, placeholder = "Select month", className }: MonthPickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date())

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1))
  }

  const selectMonth = (month: number) => {
    const newDate = new Date(currentMonth.getFullYear(), month, 1)
    onSelect(newDate)
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]

  const presets = [
    { label: 'This Month', getValue: () => new Date() },
    { label: 'Last Month', getValue: () => subMonths(new Date(), 1) },
    { label: 'Clear', getValue: () => undefined }
  ]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          {selected ? format(selected, "MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 pointer-events-auto" align="start">
        {/* Quick presets — match DatePickerVirgilio */}
        <div className="flex gap-1 mb-3">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[12.5px]"
              onClick={() => onSelect(preset.getValue())}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Year navigation */}
        <div className="flex items-center justify-between mb-3">
          <select
            aria-label="Year"
            value={currentMonth.getFullYear()}
            onChange={(e) => setCurrentMonth(new Date(Number(e.target.value), currentMonth.getMonth(), 1))}
            className={headerSelectClass}
          >
            {(() => {
              const now = new Date().getFullYear()
              return Array.from({ length: 62 }, (_, i) => now + 1 - i)
            })().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-lg"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4 text-virgilio-text" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-lg"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4 text-virgilio-text" />
            </Button>
          </div>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-1">
          {months.map((month, index) => {
            const isSelected =
              selected &&
              selected.getMonth() === index &&
              selected.getFullYear() === currentMonth.getFullYear()
            return (
              <button
                key={month}
                type="button"
                onClick={() => selectMonth(index)}
                className={cn(
                  'h-8 w-16 rounded-lg text-[12.5px] font-medium transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
                  isSelected
                    ? 'bg-virgilio-purple text-white'
                    : 'text-virgilio-text hover:bg-[hsl(var(--menu-hover))]'
                )}
              >
                {month}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
