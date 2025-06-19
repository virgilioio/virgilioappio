
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold">
              {format(currentMonth, "yyyy")}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {months.map((month, index) => {
              const isSelected = selected && 
                selected.getMonth() === index && 
                selected.getFullYear() === currentMonth.getFullYear()
              
              return (
                <Button
                  key={month}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => selectMonth(index)}
                >
                  {month}
                </Button>
              )
            })}
          </div>

          {/* Presets */}
          <div className="space-y-1 border-t pt-3">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8"
                onClick={() => onSelect(preset.getValue())}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
