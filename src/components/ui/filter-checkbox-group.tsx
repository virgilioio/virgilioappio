import { useState } from 'react'
import { Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FilterCheckboxOption {
  value: string
  label: string
  count: number
}

interface FilterCheckboxGroupProps {
  label: string
  options: FilterCheckboxOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
  onClear?: () => void
  searchable?: boolean
  searchThreshold?: number
  maxVisible?: number
  className?: string
}

export function FilterCheckboxGroup({
  label,
  options,
  selectedValues,
  onToggle,
  onClear,
  searchable,
  searchThreshold = 8,
  maxVisible = 6,
  className,
}: FilterCheckboxGroupProps) {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  if (options.length === 0) return null

  const showSearch = searchable !== false && options.length > searchThreshold
  const isActive = selectedValues.length > 0

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const visible = showAll ? filtered : filtered.slice(0, maxVisible)
  const hiddenCount = filtered.length - maxVisible

  return (
    <div className={cn('space-y-2.5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-poppins font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        {isActive && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-primary hover:text-primary/80 font-poppins transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${label.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs rounded-md"
          />
        </div>
      )}

      {/* Checkbox list */}
      <div className="space-y-0.5">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1 font-poppins">No results</p>
        ) : (
          visible.map(opt => {
            const checked = selectedValues.includes(opt.value)
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
                  'hover:bg-accent/30',
                  checked && 'bg-accent/20',
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(opt.value)}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1 text-xs font-inter text-foreground truncate">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{opt.count}</span>
              </label>
            )
          })
        )}

        {!showAll && hiddenCount > 0 && !search && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-primary hover:text-primary/80 font-poppins font-medium px-2 py-1 transition-colors"
          >
            Show {hiddenCount} more
          </button>
        )}
        {showAll && hiddenCount > 0 && !search && (
          <button
            onClick={() => setShowAll(false)}
            className="text-xs text-primary hover:text-primary/80 font-poppins font-medium px-2 py-1 transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  )
}
