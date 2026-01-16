
import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface SearchableSelectOption {
  value: string
  label: string
  badge?: string
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive'
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  onCreateNew?: () => void
  createNewLabel?: string
  error?: string
  required?: boolean
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
  onCreateNew,
  createNewLabel = "Create new",
  error,
  required,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find((option) => option.value === value)

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={!!error}
            className={cn(
              "w-full justify-between",
              error && "border-destructive focus:ring-destructive",
              className
            )}
            disabled={disabled}
          >
            {selectedOption ? selectedOption.label : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[300px] overflow-y-auto">
              {onCreateNew && (
                <>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false)
                        onCreateNew()
                      }}
                      className="text-primary cursor-pointer"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {createNewLabel}
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={(selectedLabel) => {
                      // Find the option that matches the selected label
                      const matchedOption = options.find(opt => opt.label.toLowerCase() === selectedLabel.toLowerCase())
                      if (matchedOption) {
                        onValueChange(matchedOption.value === value ? "" : matchedOption.value)
                      }
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                      {option.badge && (
                        <Badge variant={option.badgeVariant || 'secondary'} className="ml-2 text-xs">
                          {option.badge}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
