
import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selectedValues: string[]
  onSelectionChange: (values: string[]) => void
  placeholder?: string
  className?: string
  maxDisplay?: number
}

export function MultiSelect({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select items",
  className,
  maxDisplay = 2
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleToggle = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value]
    onSelectionChange(newValues)
  }

  const handleClear = () => {
    onSelectionChange([])
  }

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder
    if (selectedValues.length <= maxDisplay) {
      return selectedValues
        .map(value => options.find(opt => opt.value === value)?.label || value)
        .join(", ")
    }
    return `${selectedValues.length} selected`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between text-left font-normal",
            !selectedValues.length && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{getDisplayText()}</span>
          <div className="flex items-center gap-1">
            {selectedValues.length > 0 && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => handleToggle(option.value)}
            >
              <Checkbox
                checked={selectedValues.includes(option.value)}
                onChange={() => {}} // Controlled by parent
              />
              <label className="text-sm cursor-pointer">
                {option.label}
              </label>
            </div>
          ))}
          {options.length === 0 && (
            <div className="text-sm text-muted-foreground p-2">
              No options available
            </div>
          )}
        </div>
        {selectedValues.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="w-full"
            >
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
