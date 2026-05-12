import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Clock } from 'lucide-react'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import type { Deal } from '@/hooks/useDeals'
import { cn } from '@/lib/utils'

function formatAmount(amount: number | null, currency: string) {
  if (amount === null || amount === undefined) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)
  return `${symbol}${formatted}`
}

function ageInDays(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  return `${days}d`
}

interface DealCardProps {
  deal: Deal
  onClick?: () => void
  className?: string
}

export function DealCard({ deal, onClick, className }: DealCardProps) {
  const ownerInitials = deal.owner_name
    ? deal.owner_name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : '?'

  const ownerFirstName = deal.owner_name?.split(' ')[0] ?? null
  const amountLabel = `${formatAmount(deal.amount, deal.currency)} ${deal.currency}`

  return (
    <Card
      className={cn('relative p-4 min-h-32 bg-white border-border cursor-pointer', className)}
      onClick={onClick}
      role="button"
      aria-label="Open deal"
    >
      {/* Top-right age badge */}
      <Badge
        variant="secondary"
        className="absolute top-2 right-2 gap-1"
      >
        <Clock className="h-3 w-3" />
        {ageInDays(deal.created_at)}
      </Badge>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pr-12">
          <div className="font-medium text-sm text-text-primary truncate">{deal.title}</div>
          <div className="flex flex-col gap-0.5 mt-1">
            {deal.organization_name ? (
              <div className="text-xs text-text-secondary truncate">{deal.organization_name}</div>
            ) : (
              <div className="text-xs text-text-tertiary">No company</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: amount (left) + owner badge (right) */}
      <div className="absolute left-4 right-4 bottom-3 flex justify-between items-center gap-2">
        <Badge variant="outline">{amountLabel}</Badge>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="gap-1 text-[10px] px-1.5">
                <Avatar className="h-3.5 w-3.5">
                  {deal.owner_avatar_url && (
                    <AvatarImage src={deal.owner_avatar_url} alt={deal.owner_name ?? ''} />
                  )}
                  <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[8px] font-semibold">
                    {ownerInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{ownerFirstName ?? 'Unassigned'}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {deal.owner_name ?? 'Unassigned'}
              {deal.owner_email ? ` · ${deal.owner_email}` : ''}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </Card>
  )
}
