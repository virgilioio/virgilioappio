import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Wallet, CheckCircle2, Clock } from 'lucide-react'
import { useDealPayments, type DealPayment } from '@/hooks/useDealPayments'
import { InlineEmpty } from '@/components/ui/empty-state'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { cn } from '@/lib/utils'
import { DealPaymentFormDialog } from './DealPaymentFormDialog'
import { useAuth } from '@/contexts/AuthContext'

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  check: 'Check',
  other: 'Other',
}

function fmt(amount: number, currency: string) {
  const s = CURRENCY_SYMBOLS[currency] ?? ''
  return `${s}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)}`
}

export function DealPaymentsCard({ dealId, currency }: { dealId: string; currency: string }) {
  const payments = useDealPayments(dealId)
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DealPayment | null>(null)

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (p: DealPayment) => {
    setEditing(p)
    setOpen(true)
  }

  return (
    <>
      <Card className="bg-surface-primary border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Payments
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Register payment
          </Button>
        </CardHeader>
        <CardContent>
          {payments.isLoading ? (
            <div className="text-sm text-virgilio-muted">Loading…</div>
          ) : (payments.data ?? []).length === 0 ? (
            <InlineEmpty text="No payments yet." />
          ) : (
            <ul className="space-y-2">
              {(payments.data ?? []).map((p) => {
                const canEdit = p.created_by === user?.id
                const isPaid = p.status === 'paid'
                const dateLabel = isPaid
                  ? p.paid_at
                    ? `Paid · ${new Date(p.paid_at).toLocaleDateString()}`
                    : 'Paid'
                  : p.due_on
                    ? `Due ${new Date(p.due_on).toLocaleDateString()}`
                    : 'Due on Won'
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3 bg-card">
                    {isPaid ? (
                      <CheckCircle2 className="h-4 w-4 text-virgilio-success shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-virgilio-warning shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary truncate">
                          {p.label ?? (isPaid ? 'Payment' : 'Scheduled payment')}
                        </span>
                        {p.method && isPaid && (
                          <span className="text-xs text-text-tertiary">• {METHOD_LABEL[p.method] ?? p.method}</span>
                        )}
                      </div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        {dateLabel}
                        {p.note && <span className="ml-2 text-text-secondary">— {p.note}</span>}
                      </div>
                    </div>
                    <span className={cn('text-sm font-semibold tabular-nums', isPaid ? 'text-virgilio-success' : 'text-virgilio-warning')}>
                      {fmt(p.amount, p.currency)}
                    </span>
                    {canEdit && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-virgilio-error hover:text-virgilio-error"
                          onClick={() => {
                            if (confirm('Delete this payment?')) payments.remove.mutate(p.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {open && (
        <DealPaymentFormDialog
          open={open}
          onOpenChange={setOpen}
          dealId={dealId}
          currency={currency}
          payment={editing}
        />
      )}
    </>
  )
}
