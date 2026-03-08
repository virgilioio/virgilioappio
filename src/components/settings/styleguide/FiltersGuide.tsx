import { useState } from 'react'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { FilterSheet } from '@/components/ui/filter-sheet'
import { FilterCheckboxGroup, type FilterCheckboxOption } from '@/components/ui/filter-checkbox-group'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal } from 'lucide-react'

// Sample data
const STATUS_OPTIONS: FilterChipOption[] = [
  { value: 'open', label: 'Open', count: 24 },
  { value: 'closed', label: 'Closed', count: 8 },
  { value: 'draft', label: 'Draft', count: 3 },
  { value: 'archived', label: 'Archived', count: 12 },
]

const DEPARTMENT_OPTIONS: FilterChipOption[] = [
  { value: 'engineering', label: 'Engineering', count: 18 },
  { value: 'design', label: 'Design', count: 7 },
  { value: 'marketing', label: 'Marketing', count: 5 },
  { value: 'sales', label: 'Sales', count: 11 },
  { value: 'hr', label: 'Human Resources', count: 4 },
]

const LOCATION_OPTIONS: FilterChipOption[] = [
  { value: 'nyc', label: 'New York', count: 14 },
  { value: 'sf', label: 'San Francisco', count: 9 },
  { value: 'london', label: 'London', count: 6 },
  { value: 'berlin', label: 'Berlin', count: 3 },
]

const SHEET_CITY_OPTIONS: FilterCheckboxOption[] = [
  { value: 'nyc', label: 'New York', count: 14 },
  { value: 'sf', label: 'San Francisco', count: 9 },
  { value: 'la', label: 'Los Angeles', count: 7 },
  { value: 'chicago', label: 'Chicago', count: 5 },
  { value: 'london', label: 'London', count: 6 },
  { value: 'berlin', label: 'Berlin', count: 3 },
  { value: 'paris', label: 'Paris', count: 4 },
  { value: 'tokyo', label: 'Tokyo', count: 2 },
  { value: 'sydney', label: 'Sydney', count: 1 },
]

const SHEET_SKILL_OPTIONS: FilterCheckboxOption[] = [
  { value: 'react', label: 'React', count: 22 },
  { value: 'typescript', label: 'TypeScript', count: 19 },
  { value: 'python', label: 'Python', count: 15 },
  { value: 'node', label: 'Node.js', count: 12 },
  { value: 'figma', label: 'Figma', count: 8 },
  { value: 'sql', label: 'SQL', count: 10 },
]

export function FiltersGuide() {
  // Chip popover state
  const [chipStatus, setChipStatus] = useState<string[]>([])
  const [chipDept, setChipDept] = useState<string[]>([])
  const [chipLocation, setChipLocation] = useState<string[]>([])

  // Filter sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetCities, setSheetCities] = useState<string[]>([])
  const [sheetSkills, setSheetSkills] = useState<string[]>([])

  // Standalone checkbox group state
  const [cbCities, setCbCities] = useState<string[]>([])

  const clearChips = () => {
    setChipStatus([])
    setChipDept([])
    setChipLocation([])
  }

  const clearSheet = () => {
    setSheetCities([])
    setSheetSkills([])
  }

  const hasChipFilters = chipStatus.length > 0 || chipDept.length > 0 || chipLocation.length > 0

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-heading font-semibold">
          Filters<span className="text-primary">.</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Consistent filter components used across the platform — chip popovers for primary filters, sheets for overflow filters, and checkbox groups inside sheets.
        </p>
      </div>

      {/* Section 1: Filter Chip Popover */}
      <div className="space-y-3">
        <h4 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider">
          Filter Chip Popover
        </h4>
        <p className="text-xs text-muted-foreground">
          Pill-shaped chips that expand into a checkbox dropdown. Inactive state shows <code className="text-xs bg-muted px-1 py-0.5 rounded">⊕ Label</code>, active state shows <code className="text-xs bg-muted px-1 py-0.5 rounded">Label | Value</code>.
        </p>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChipPopover
              label="Status"
              options={STATUS_OPTIONS}
              selectedValues={chipStatus}
              onSelectionChange={setChipStatus}
            />
            <FilterChipPopover
              label="Department"
              options={DEPARTMENT_OPTIONS}
              selectedValues={chipDept}
              onSelectionChange={setChipDept}
              searchable
            />
            <FilterChipPopover
              label="Location"
              options={LOCATION_OPTIONS}
              selectedValues={chipLocation}
              onSelectionChange={setChipLocation}
            />
            {hasChipFilters && (
              <button
                onClick={clearChips}
                className="text-xs font-poppins text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Try clicking the chips above to see inactive → active states and the popover dropdown.
          </p>
        </div>
      </div>

      {/* Section 2: Filter Sheet */}
      <div className="space-y-3">
        <h4 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider">
          Filter Sheet
        </h4>
        <p className="text-xs text-muted-foreground">
          A slide-out panel for overflow or secondary filters. Contains <code className="text-xs bg-muted px-1 py-0.5 rounded">FilterCheckboxGroup</code> sections with search, counts, and "Show more" toggles.
        </p>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSheetOpen(true)}
            className="gap-2 font-poppins"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Open Filter Sheet
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Opens a right-side sheet with checkbox groups, a sticky "Apply" footer, and "Clear all" action.
          </p>

          <FilterSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title="More Filters"
            description="Demo of the filter sheet with checkbox groups"
            onClearAll={clearSheet}
            onApply={() => {}}
          >
            <FilterCheckboxGroup
              label="City"
              options={SHEET_CITY_OPTIONS}
              selectedValues={sheetCities}
              onToggle={(v) => setSheetCities(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
              onClear={() => setSheetCities([])}
              searchable
            />
            <FilterCheckboxGroup
              label="Skills"
              options={SHEET_SKILL_OPTIONS}
              selectedValues={sheetSkills}
              onToggle={(v) => setSheetSkills(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
              onClear={() => setSheetSkills([])}
              searchable
            />
          </FilterSheet>
        </div>
      </div>

      {/* Section 3: Filter Checkbox Group (standalone) */}
      <div className="space-y-3">
        <h4 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider">
          Filter Checkbox Group
        </h4>
        <p className="text-xs text-muted-foreground">
          Standalone checkbox list used inside filter sheets. Includes optional search bar, item counts, and "Show more" / "Show less" toggle.
        </p>
        <div className="rounded-lg border border-border bg-card p-4 max-w-xs">
          <FilterCheckboxGroup
            label="City"
            options={SHEET_CITY_OPTIONS}
            selectedValues={cbCities}
            onToggle={(v) => setCbCities(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
            onClear={() => setCbCities([])}
            searchable
            maxVisible={4}
          />
        </div>
      </div>
    </div>
  )
}
