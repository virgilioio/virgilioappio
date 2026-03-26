
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

interface NewBadgeProps {
  show: boolean
}

export function NewBadge({ show }: NewBadgeProps) {
  if (!show) return null
  
  return (
    <Badge 
      variant="outline" 
      className="ml-2 text-xs font-medium px-2 py-0.5 border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1"
    >
      <Sparkles className="h-3 w-3" />
      New
    </Badge>
  )
}
