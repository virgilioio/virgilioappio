import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Check } from 'lucide-react'
import { CATEGORY_LABELS, type IntegrationCategory } from './integrationRegistry'
import { cn } from '@/lib/utils'

interface IntegrationCardProps {
  name: string
  description: string
  category: IntegrationCategory
  isConnected: boolean
  logo: React.ReactNode
  isActive: boolean
  onConfigure: () => void
}

export function IntegrationCard({
  name,
  description,
  category,
  isConnected,
  logo,
  isActive,
  onConfigure,
}: IntegrationCardProps) {
  return (
    <Card
      className={cn(
        'relative flex flex-col p-5 gap-4 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        isActive && 'ring-2 ring-primary border-primary',
      )}
      onClick={onConfigure}
    >
      {/* Header row: logo + status */}
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60">
          {logo}
        </div>
        {isConnected ? (
          <Badge variant="integration-connected" className="gap-1 text-[11px] font-medium">
            <Check className="h-3 w-3" />
            Installed
          </Badge>
        ) : (
          <Badge variant="integration-disconnected" className="text-[11px] font-medium">
            Not Installed
          </Badge>
        )}
      </div>

      {/* Name + description */}
      <div className="flex-1 space-y-1">
        <h4 className="text-sm font-poppins font-semibold text-foreground leading-tight">{name}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
      </div>

      {/* Footer: category */}
      <div className="flex items-center pt-1">
        <Badge variant="category" className="text-[10px] font-medium uppercase tracking-wider">
          {CATEGORY_LABELS[category]}
        </Badge>
      </div>
    </Card>
  )
}
