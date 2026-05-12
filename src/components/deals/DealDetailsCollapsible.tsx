import { useState } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Building2, DollarSign, User, Calendar, FileText, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import type { Deal } from '@/hooks/useDeals'

function formatAmount(amount: number | null, currency: string) {
  if (amount === null || amount === undefined) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  return `${symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`
}

interface DealDetailsCollapsibleProps {
  deal: Deal
}

export function DealDetailsCollapsible({ deal }: DealDetailsCollapsibleProps) {
  const [open, setOpen] = useState(false)

  const ownerInitials = deal.owner_name
    ? deal.owner_name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    : '?'

  return (
    <Card className="bg-surface-primary border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="px-6 py-4 flex items-center justify-between gap-3 min-w-0">
            <CardTitle className="truncate">Deal Details</CardTitle>
            <div className="flex items-center gap-3 min-w-0">
              {!open && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-text-secondary min-w-0 max-w-[60%]">
                  <div className="flex items-center gap-1 min-w-0">
                    <DollarSign className="h-3 w-3 text-text-tertiary shrink-0" />
                    <span className="truncate">{formatAmount(deal.amount, deal.currency)} {deal.currency}</span>
                  </div>
                  {deal.organization_name && (
                    <div className="flex items-center gap-1 min-w-0">
                      <Building2 className="h-3 w-3 text-text-tertiary shrink-0" />
                      <span className="max-w-[140px] truncate">{deal.organization_name}</span>
                    </div>
                  )}
                  {deal.owner_name && (
                    <div className="flex items-center gap-1 min-w-0">
                      <Avatar className="h-4 w-4">
                        {deal.owner_avatar_url && <AvatarImage src={deal.owner_avatar_url} alt={deal.owner_name} />}
                        <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[8px] font-semibold">
                          {ownerInitials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[120px] truncate">{deal.owner_name}</span>
                    </div>
                  )}
                </div>
              )}
              <ChevronDown className={cn('h-4 w-4 text-text-tertiary transition-transform', open && 'rotate-180')} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Owner */}
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {deal.owner_avatar_url && <AvatarImage src={deal.owner_avatar_url} alt={deal.owner_name ?? ''} />}
                  <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple text-[10px] font-semibold">
                    {ownerInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-text-primary">{deal.owner_name ?? 'Unassigned'}</span>
              </div>
            </div>

            {/* Company */}
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-text-primary">{deal.organization_name ?? '—'}</span>
            </div>

            {/* Amount */}
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-text-primary">
                <span className="font-poppins font-semibold tracking-[-0.02em]">{formatAmount(deal.amount, deal.currency)}</span>{' '}
                <span className="text-xs text-text-tertiary">{deal.currency}</span>
              </span>
            </div>

            {/* Expected close */}
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-text-primary">
                {deal.expected_close_date
                  ? new Date(deal.expected_close_date).toLocaleDateString()
                  : <span className="text-text-tertiary italic">No close date</span>}
              </span>
            </div>

            {/* Description */}
            {deal.notes && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{deal.notes}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
