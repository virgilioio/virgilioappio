import { ArrowUpDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SORTS, type SortKey } from '@/lib/candidateDates'

/** How the Candidates list is ordered (2026-10-14). */
export function SortMenu({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
  const current = SORTS.find((s) => s.key === value) ?? SORTS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-poppins font-medium text-text-secondary hover:text-text-primary hover:bg-[#FAFAF7] transition-colors whitespace-nowrap"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="text-text-tertiary">Sort:</span>
          <span className="text-text-primary">{current.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-56">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as SortKey)}>
          {SORTS.map((s) => (
            <DropdownMenuRadioItem key={s.key} value={s.key}>{s.label}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
