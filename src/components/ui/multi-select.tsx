
import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ChevronDown, X, Search } from "lucide-react"
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
  searchable?: boolean
  emptyMessage?: string
}

export function MultiSelect({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select items",
  className,
  maxDisplay = 2,
  searchable = true,
  emptyMessage = "No options found"
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')

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

  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between text-left font-normal bg-background",
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
      <PopoverContent 
        className="w-full p-0 bg-background border shadow-lg z-50" 
        align="start"
        sideOffset={4}
      >
        <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          )}
          
          {filteredOptions.length === 0 ? (
            <div className="text-sm text-muted-foreground p-2 text-center">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-muted rounded"
                onClick={() => handleToggle(option.value)}
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onChange={() => {}} // Controlled by parent
                />
                <label className="text-sm cursor-pointer flex-1">
                  {option.label}
                </label>
              </div>
            ))
          )}
        </div>
        
        {selectedValues.length > 0 && (
          <div className="border-t p-2 bg-muted/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="w-full h-8"
            >
              Clear all ({selectedValues.length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
