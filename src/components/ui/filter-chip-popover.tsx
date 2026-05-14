import { useState, useCallback } from 'react'
import { ChevronDown, Search } from 'lucide-react'
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
  /** @deprecated kept for backward compatibility — only the soft chip is supported now. */
  variant?: 'soft' | 'pill'
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
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 font-poppins font-medium transition-colors duration-150 whitespace-nowrap',
            'h-9 px-3.5 rounded-lg border border-virgilio-border text-[13px] text-text-primary',
            isActive
              ? 'bg-[#FAFAF7] hover:bg-[hsl(var(--menu-hover))]'
              : 'bg-white hover:bg-[#FAFAF7]',
            className,
          )}
        >
          {isActive ? (
            <>
              <span className="text-text-primary">{label}</span>
              <span className="text-[hsl(var(--menu-group-color))]">·</span>
              <span className="text-virgilio-purple">{summaryText}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </>
          ) : (
            <>
              <span aria-hidden className="text-[15px] leading-none text-[hsl(var(--menu-group-color))] -mt-px">+</span>
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
          <span className="text-menu-group font-inter uppercase text-[hsl(var(--menu-group-color))]">{label}</span>
          {isActive && (
            <button
              onClick={clearSelection}
              className="text-[11px] text-text-tertiary hover:text-foreground transition-colors font-inter"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        {showSearch && (
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--menu-group-color))]" />
              <Input
                placeholder={`Search ${label.toLowerCase()}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-[12.5px] rounded-md"
              />
            </div>
          </div>
        )}

        {/* Options list */}
        <div className="max-h-[240px] overflow-y-auto px-1 pb-1">
          {visible.length === 0 ? (
            <div className="px-3 py-4 text-[12.5px] text-text-tertiary text-center font-inter">No results</div>
          ) : (
            visible.map(opt => {
              const checked = selectedValues.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-2.5 h-[var(--menu-item-h)] px-2 rounded-[var(--menu-item-radius)] cursor-pointer transition-colors',
                    'hover:bg-[hsl(var(--menu-hover))]',
                    checked && 'bg-[hsl(var(--menu-selected))]',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(opt.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="flex-1 text-menu-item font-inter text-foreground truncate">{opt.label}</span>
                  <span className="text-[10px] text-[hsl(var(--menu-group-color))] tabular-nums">{opt.count}</span>
                </label>
              )
            })
          )}

          {!showAll && hiddenCount > 0 && !search && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full px-2 h-[var(--menu-item-h)] text-[12.5px] text-virgilio-purple hover:text-virgilio-purple/80 font-inter font-medium text-left transition-colors"
            >
              Show {hiddenCount} more
            </button>
          )}
          {showAll && hiddenCount > 0 && !search && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full px-2 h-[var(--menu-item-h)] text-[12.5px] text-virgilio-purple hover:text-virgilio-purple/80 font-inter font-medium text-left transition-colors"
            >
              Show less
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[hsl(var(--tbl-divider-color))] px-2 py-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-tertiary font-inter pl-1">
            {isActive ? `${selectedValues.length} selected` : ''}
          </span>
          <Button
            size="sm"
            className="h-7 text-[12px] font-poppins px-3"
            onClick={() => setOpen(false)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
