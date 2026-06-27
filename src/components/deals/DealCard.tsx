import { Clock } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Deal } from '@/hooks/useDeals'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { cn } from '@/lib/utils'

const BRAND_COLORS = [
  '#7C5CFA', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#6366F1',
]

function brandColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return BRAND_COLORS[h % BRAND_COLORS.length]
}

function initials(name: string, max = 2): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, max)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function formatAmount(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

interface DealCardProps {
  deal: Deal
  onClick?: () => void
  className?: string
  /** Override the amount shown (e.g. weighted). */
  displayAmount?: number | null
  /** Currency label to render under the amount. Defaults to deal currency. */
  displayCurrency?: string
}

export function DealCard({ deal, onClick, className, displayAmount, displayCurrency }: DealCardProps) {
  const amount = displayAmount !== undefined ? displayAmount : deal.amount
  const currency = displayCurrency ?? deal.currency
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''

  const days = daysSince(deal.stage_changed_at ?? deal.created_at)
  const stale = days >= 30

  const ownerName = deal.owner_name ?? null
  const ownerFirst = ownerName?.split(' ')[0] ?? 'Unassigned'
  const ownerInits = initials(ownerName ?? '?')
  const ownerColor = brandColor(ownerName ?? deal.owner_id ?? 'x')

  const companyName = deal.organization_name ?? null
  const companyColor = brandColor(companyName ?? deal.organization_id ?? 'no-company')

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      aria-label={`Open deal ${deal.title}`}
      className={cn(
        'group relative cursor-pointer bg-white rounded-[11px] px-3 pt-2.5 pb-2.5',
        'transition-shadow duration-150',
        className,
      )}
      style={{
        border: '1px solid #E7E8EE',
        boxShadow: '0 1px 2px rgba(13, 13, 9, 0.04)',
      }}
    >
      {/* Top row: title + days-in-stage */}
      <div className="flex items-start gap-2">
        <div
          className="flex-1 min-w-0 font-inter font-semibold text-[12.5px] leading-snug text-text-primary"
          style={{ letterSpacing: '-0.005em' }}
        >
          <span className="line-clamp-2">{deal.title}</span>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-1 shrink-0 tabular-nums',
            'text-[11px]',
            stale ? 'font-semibold' : 'font-medium',
          )}
          style={{ color: stale ? '#D97706' : '#8B8F9E' }}
          title={`${days} day${days === 1 ? '' : 's'} in this stage`}
        >
          <Clock className="h-3 w-3" strokeWidth={2} />
          {days}d
        </div>
      </div>

      {/* Company line */}
      <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
        <span
          className="flex shrink-0 items-center justify-center rounded-[4px] font-poppins text-white text-[9px] font-semibold"
          style={{ width: 16, height: 16, background: companyColor }}
          aria-hidden
        >
          {initials(companyName ?? 'NC', 1)}
        </span>
        <span className="truncate text-[11.5px] text-text-secondary">
          {companyName ?? 'No company'}
        </span>
      </div>

      {/* Footer: amount + owner */}
      <div
        className="mt-2.5 pt-2 flex items-center justify-between gap-2"
        style={{ borderTop: '1px solid #F1F0EC' }}
      >
        <div className="min-w-0 flex items-baseline gap-1 tabular-nums">
          <span
            className="font-poppins font-semibold text-[12.5px] text-text-primary"
            style={{ letterSpacing: '-0.01em' }}
          >
            {symbol}
            {formatAmount(amount)}
          </span>
          <span className="text-[10px] font-medium uppercase text-text-tertiary">{currency}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Avatar className="h-[18px] w-[18px]">
            {deal.owner_avatar_url && (
              <AvatarImage src={deal.owner_avatar_url} alt={ownerName ?? ''} />
            )}
            <AvatarFallback
              className="text-[8px] font-poppins font-semibold text-white"
              style={{ backgroundColor: ownerColor }}
            >
              {ownerInits}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-text-secondary truncate max-w-[80px]">{ownerFirst}</span>
        </div>
      </div>
    </div>
  )
}
