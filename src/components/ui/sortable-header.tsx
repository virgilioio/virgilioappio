
import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { SortDirection } from '@/hooks/useSortableTable'
import { cn } from '@/lib/utils'

interface SortableHeaderProps {
  children: React.ReactNode
  sortKey: string
  currentSort: { key: string | null; direction: SortDirection }
  onSort: (key: string) => void
  className?: string
}

export function SortableHeader({ 
  children, 
  sortKey, 
  currentSort, 
  onSort, 
  className 
}: SortableHeaderProps) {
  const isActive = currentSort.key === sortKey
  const direction = isActive ? currentSort.direction : null

  const getSortIcon = () => {
    if (!isActive || !direction) return <ArrowUpDown className="h-3 w-3" />
    if (direction === 'asc') return <ArrowUp className="h-3 w-3" />
    return <ArrowDown className="h-3 w-3" />
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(sortKey)}
      className={cn(
        "h-auto p-0 font-medium justify-start hover:bg-transparent",
        isActive && "text-primary",
        className
      )}
    >
      <span className="flex items-center gap-1">
        {children}
        {getSortIcon()}
      </span>
    </Button>
  )
}
