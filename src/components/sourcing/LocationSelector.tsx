import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { LOCATION_OPTIONS, type LocationOption } from "@/constants/locations"
import { useState } from "react"

interface LocationSelectorProps {
  selectedLocations: string[] // Array of location values
  onLocationsChange: (locations: string[]) => void
}

export function LocationSelector({ selectedLocations, onLocationsChange }: LocationSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const handleSelect = (value: string) => {
    if (!selectedLocations.includes(value)) {
      onLocationsChange([...selectedLocations, value])
    }
    setSearchValue("")
    setOpen(false)
  }

  const handleRemove = (value: string) => {
    onLocationsChange(selectedLocations.filter(loc => loc !== value))
  }

  const getLocationLabel = (value: string) => {
    const location = LOCATION_OPTIONS.find(loc => loc.value === value)
    return location?.label || value
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            Add location...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search cities, states, or countries..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>No locations found.</CommandEmpty>
              <CommandGroup>
                {LOCATION_OPTIONS
                  .filter(loc => !selectedLocations.includes(loc.value))
                  .filter(loc => 
                    searchValue === "" || 
                    loc.label.toLowerCase().includes(searchValue.toLowerCase())
                  )
                  .slice(0, 50) // Limit results for performance
                  .map((location) => (
                    <CommandItem
                      key={location.value}
                      value={location.value}
                      onSelect={handleSelect}
                    >
                      <div className="flex flex-col">
                        <span>{location.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {location.type === 'city' && 'City'}
                          {location.type === 'state' && 'State/Province'}
                          {location.type === 'country' && 'Country'}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedLocations.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {getLocationLabel(value)}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => handleRemove(value)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
