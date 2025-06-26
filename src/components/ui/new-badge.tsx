
import { Badge } from '@/components/ui/badge'

interface NewBadgeProps {
  show: boolean
}

export function NewBadge({ show }: NewBadgeProps) {
  if (!show) return null
  
  return (
    <Badge 
      variant="destructive" 
      className="ml-2 text-xs font-semibold px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white"
    >
      New!
    </Badge>
  )
}
