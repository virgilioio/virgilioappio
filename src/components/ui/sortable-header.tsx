import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp } from 'lucide-react'
import { SortDirection } from '@/hooks/useSortableTable'
import { cn } from '@/lib/utils'

interface SortableHeaderProps {
  children: React.ReactNode
  sortKey: string
  currentSort: { key: string | null; direction: SortDirection }
  onSort: (key: string) => void
  className?: string
}

/**
 * §3 Sort: one arrow that turns 180° (--dur-switch, --ease-out) between ascending and
 * descending; unsorted columns show the neutral up/down glyph. The rows themselves
 * FLIP to their new places (useSortableTable).
 */
export function SortableHeader({
  children,
  sortKey,
  currentSort,
  onSort,
  className
}: SortableHeaderProps) {
  const isActive = currentSort.key === sortKey
  const direction = isActive ? currentSort.direction : null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(sortKey)}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}
      className={cn(
        "h-auto p-0 font-medium justify-start hover:bg-transparent",
        isActive && "text-primary",
        className
      )}
    >
      <span className="flex items-center gap-1">
        {children}
        {direction ? (
          <ArrowUp aria-hidden="true" data-dir={direction} className="gio-sort-arrow h-3 w-3" />
        ) : (
          <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
        )}
      </span>
    </Button>
  )
}
