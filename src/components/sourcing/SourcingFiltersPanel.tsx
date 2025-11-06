import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MultiSelect } from '@/components/ui/multi-select'
import { SourcingProjectFilters } from '@/types/sourcing'
import { COUNTRIES } from '@/constants/countries'
import { X } from 'lucide-react'

interface SourcingFiltersPanelProps {
  filters: SourcingProjectFilters
  onFiltersChange: (filters: SourcingProjectFilters) => void
}

export function SourcingFiltersPanel({
  filters,
  onFiltersChange
}: SourcingFiltersPanelProps) {
  const selectedCountries = COUNTRIES.filter(country => 
    filters.location?.includes(country.value)
  )

  return (
    <div className="w-64 border-r border-border bg-surface-primary p-4 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters</h3>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onFiltersChange({
            matchTiers: [],
            location: [],
            minExperience: 0,
            maxExperience: 30,
            source: 'all'
          })}
          className="h-7 px-2 text-xs"
        >
          Reset
        </Button>
      </div>

      {/* Source Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Source</Label>
        <div className="space-y-2">
          {(['all', 'local', 'coresignal'] as const).map(source => (
            <label key={source} className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={!filters.source || filters.source === source}
                onCheckedChange={(checked) => {
                  onFiltersChange({
                    ...filters,
                    source: checked ? source : 'all'
                  })
                }}
              />
              <span className="text-sm capitalize">{source}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Match Tier */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Match Tier</Label>
        <div className="space-y-2">
          {(['excellent', 'good', 'fair', 'minimal'] as const).map(tier => (
            <label key={tier} className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={filters.matchTiers?.includes(tier)}
                onCheckedChange={(checked) => {
                  onFiltersChange({
                    ...filters,
                    matchTiers: checked 
                      ? [...(filters.matchTiers || []), tier]
                      : (filters.matchTiers || []).filter(t => t !== tier)
                  })
                }}
              />
              <span className="text-sm capitalize">{tier}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Location Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Location</Label>
        <MultiSelect
          options={COUNTRIES}
          selectedValues={filters.location || []}
          onSelectionChange={(values) => onFiltersChange({ ...filters, location: values })}
          placeholder="Select countries..."
          searchable
          maxDisplay={0}
        />
        
        {/* Selected Countries Badges */}
        {selectedCountries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selectedCountries.map(country => (
              <Badge 
                key={country.value} 
                variant="secondary"
                className="text-xs pr-1 pl-2 py-0.5"
              >
                {country.label}
                <button
                  onClick={() => {
                    onFiltersChange({
                      ...filters,
                      location: (filters.location || []).filter(c => c !== country.value)
                    })
                  }}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-sm p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Experience Range */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Experience (years)</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input 
              type="number"
              placeholder="Min"
              value={filters.minExperience || 0}
              onChange={(e) => onFiltersChange({ ...filters, minExperience: parseInt(e.target.value) || 0 })}
              className="h-9 text-sm"
              min={0}
              max={30}
            />
          </div>
          <span className="text-xs text-muted-foreground">to</span>
          <div className="flex-1">
            <Input 
              type="number"
              placeholder="Max"
              value={filters.maxExperience || 30}
              onChange={(e) => onFiltersChange({ ...filters, maxExperience: parseInt(e.target.value) || 30 })}
              className="h-9 text-sm"
              min={0}
              max={50}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
