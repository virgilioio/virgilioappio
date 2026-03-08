import { useState, useCallback } from 'react'
import { Plus, ChevronDown, Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FilterChipOption {
  value: string
  label: string
  count: number
}

interface FilterChipPopoverProps {
  label: string
  options: FilterChipOption[]
  selectedValues: string[]
  onSelectionChange: (values: string[]) => void
  searchable?: boolean
  searchThreshold?: number
  maxVisible?: number
  className?: string
}

export function FilterChipPopover({
  label,
  options,
  selectedValues,
  onSelectionChange,
  searchable,
  searchThreshold = 8,
  maxVisible = 8,
  className,
}: FilterChipPopoverProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const isActive = selectedValues.length > 0
  const showSearch = searchable !== false && options.length > searchThreshold

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const visible = showAll ? filtered : filtered.slice(0, maxVisible)
  const hiddenCount = filtered.length - maxVisible

  const toggle = useCallback((value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value))
    } else {
      onSelectionChange([...selectedValues, value])
    }
  }, [selectedValues, onSelectionChange])

  const clearSelection = useCallback(() => {
    onSelectionChange([])
  }, [onSelectionChange])

  // Summary text for the chip
  const summaryText = isActive
    ? selectedValues.length === 1
      ? options.find(o => o.value === selectedValues[0])?.label || selectedValues[0]
      : `${selectedValues.length}`
    : null

  if (options.length === 0) return null

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSearch(''); setShowAll(false) } }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 h-8 text-sm font-poppins font-medium transition-all duration-150 whitespace-nowrap',
            'hover:bg-accent/30',
            isActive
              ? 'bg-accent/40 border-accent-foreground/20 text-accent-foreground'
              : 'border-border text-muted-foreground hover:text-foreground',
            className,
          )}
        >
          {isActive ? (
            <>
              <span className="text-foreground">{label}</span>
              <span className="text-accent-foreground/60">|</span>
              <span className="text-accent-foreground">{summaryText}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              {label}
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[260px] p-0 overflow-hidden"
        sideOffset={6}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-xs font-poppins font-semibold text-foreground uppercase tracking-wider">{label}</span>
          {isActive && (
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-poppins"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        {showSearch && (
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`Search ${label.toLowerCase()}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-md"
              />
            </div>
          </div>
        )}

        {/* Options list */}
        <div className="max-h-[240px] overflow-y-auto px-1 pb-1">
          {visible.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center font-poppins">No results</div>
          ) : (
            visible.map(opt => {
              const checked = selectedValues.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors',
                    'hover:bg-accent/30',
                    checked && 'bg-accent/20',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(opt.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="flex-1 text-xs font-inter text-foreground truncate">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{opt.count}</span>
                </label>
              )
            })
          )}

          {/* Show more toggle */}
          {!showAll && hiddenCount > 0 && !search && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full px-2.5 py-1.5 text-xs text-primary hover:text-primary/80 font-poppins font-medium text-left transition-colors"
            >
              Show {hiddenCount} more
            </button>
          )}
          {showAll && hiddenCount > 0 && !search && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full px-2.5 py-1.5 text-xs text-primary hover:text-primary/80 font-poppins font-medium text-left transition-colors"
            >
              Show less
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2">
          <Button
            size="sm"
            className="w-full h-8 text-xs font-poppins"
            onClick={() => setOpen(false)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
