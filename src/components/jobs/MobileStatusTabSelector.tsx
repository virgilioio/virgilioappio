import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

export interface StatusTabOption {
  value: string
  label: string
  count: number
  variant: 'suggested' | 'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'
}

interface MobileStatusTabSelectorProps {
  value: string
  onValueChange: (value: string) => void
  tabs: StatusTabOption[]
}

const getTabStyles = (variant: StatusTabOption['variant']) => {
  switch (variant) {
    case 'suggested':
      return 'text-blue-600'
    case 'application':
      return 'text-pastel-purple'
    case 'recruiting':
      return 'text-pastel-yellow'
    case 'offers':
      return 'text-pastel-blue'
    case 'hired':
      return 'text-green-600'
    case 'rejected':
      return 'text-destructive'
    default:
      return 'text-text-primary'
  }
}

const getBadgeVariant = (variant: StatusTabOption['variant']) => {
  switch (variant) {
    case 'suggested':
      return 'secondary'
    case 'application':
      return 'pastel-purple'
    case 'recruiting':
      return 'pastel-yellow'
    case 'offers':
      return 'pastel-blue'
    case 'hired':
      return 'success'
    case 'rejected':
      return 'destructive'
    default:
      return 'secondary'
  }
}

export function MobileStatusTabSelector({ value, onValueChange, tabs }: MobileStatusTabSelectorProps) {
  const selectedTab = tabs.find(t => t.value === value)
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full h-12 text-base">
        <SelectValue>
          <span className="flex items-center gap-2">
            {selectedTab?.variant === 'suggested' && <Sparkles className="h-4 w-4 text-blue-600" />}
            <span className={getTabStyles(selectedTab?.variant || 'recruiting')}>
              {selectedTab?.label}
            </span>
            <Badge variant={getBadgeVariant(selectedTab?.variant || 'recruiting') as any} className="text-xs">
              {selectedTab?.count}
            </Badge>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {tabs.map((tab) => (
          <SelectItem key={tab.value} value={tab.value} className="py-3">
            <span className="flex items-center gap-2">
              {tab.variant === 'suggested' && <Sparkles className="h-4 w-4 text-blue-600" />}
              <span className={getTabStyles(tab.variant)}>{tab.label}</span>
              <Badge variant={getBadgeVariant(tab.variant) as any} className="text-xs">
                {tab.count}
              </Badge>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
