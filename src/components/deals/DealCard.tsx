import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
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

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group cursor-pointer p-3 shadow-calendly border-virgilio-border/60 hover:border-virgilio-purple/40 hover:shadow-md transition-all duration-200',
        className
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-poppins font-semibold tracking-[-0.02em] text-virgilio-text leading-snug line-clamp-2">
            {deal.title}
          </h3>
          <span className="shrink-0 text-[11px] font-medium text-virgilio-muted">
            {ageInDays(deal.created_at)}
          </span>
        </div>

        {deal.organization_name && (
          <p className="text-xs text-virgilio-muted truncate">{deal.organization_name}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-poppins font-semibold tracking-[-0.04em] text-virgilio-text">
            {formatAmount(deal.amount, deal.currency)}
            <span className="ml-1 text-[10px] text-virgilio-muted font-normal">{deal.currency}</span>
          </span>
          <Avatar className="h-6 w-6">
            {deal.owner_avatar_url && <AvatarImage src={deal.owner_avatar_url} alt={deal.owner_name ?? ''} />}
            <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[10px] font-semibold">
              {ownerInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </Card>
  )
}
