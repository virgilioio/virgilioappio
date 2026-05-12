import { Card, CardContent } from '@/components/ui/card'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { cn } from '@/lib/utils'

function fmt(amount: number, currency: string) {
  const s = CURRENCY_SYMBOLS[currency] ?? ''
  return `${s}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`
}

interface Props {
  total: number
  collected: number
  currency: string
}

export function DealBillingSummary({ total, collected, currency }: Props) {
  const outstanding = Math.max(0, total - collected)
  const fullyPaid = total > 0 && outstanding === 0
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="bg-surface-primary border-border">
        <CardContent className="p-4">
          <div className="text-xs text-text-secondary">Total deal</div>
          <div className="text-xl font-semibold mt-1 text-text-primary">{fmt(total, currency)}</div>
        </CardContent>
      </Card>
      <Card className="bg-surface-primary border-border">
        <CardContent className="p-4">
          <div className="text-xs text-text-secondary">Collected</div>
          <div className="text-xl font-semibold mt-1 text-virgilio-success">{fmt(collected, currency)}</div>
        </CardContent>
      </Card>
      <Card className="bg-surface-primary border-border">
        <CardContent className="p-4">
          <div className="text-xs text-text-secondary">Outstanding</div>
          <div className={cn('text-xl font-semibold mt-1', fullyPaid ? 'text-virgilio-success' : 'text-virgilio-warning')}>
            {fmt(outstanding, currency)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
