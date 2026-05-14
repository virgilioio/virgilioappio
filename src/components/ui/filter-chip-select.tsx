import { ChevronDown, Check } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface FilterChipSelectOption<T extends string = string> {
  value: T
  label: string
}

interface FilterChipSelectProps<T extends string = string> {
  label: string
  value: T
  options: FilterChipSelectOption<T>[]
  onChange: (value: T) => void
  className?: string
  /** Treat the default value as "active" (highlighted) too. Defaults to true. */
  alwaysActive?: boolean
}

/**
 * Single-select chip styled to match `FilterChipPopover`, but backed by a
 * dropdown menu (radio-style). Use for view-mode switchers like
 * Total / Collected / Outstanding.
 */
export function FilterChipSelect<T extends string = string>({
  label,
  value,
  options,
  onChange,
  className,
  alwaysActive = true,
}: FilterChipSelectProps<T>) {
  const current = options.find(o => o.value === value)
  const isActive = alwaysActive || !!current

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
          <span className="text-text-primary">{label}</span>
          <span className="text-[hsl(var(--menu-group-color))]">·</span>
          <span className="text-virgilio-purple">{current?.label ?? ''}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {options.map(opt => {
          const selected = opt.value === value
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onChange(opt.value)}
              data-state={selected ? "checked" : undefined}
            >
              <span className="flex-1 truncate">{opt.label}</span>
              {selected && <Check className="h-3.5 w-3.5 text-virgilio-purple" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
