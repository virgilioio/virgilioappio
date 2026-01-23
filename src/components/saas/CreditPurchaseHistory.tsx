import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Gift, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CreditPurchaseHistoryProps {
  tenantId: string
}

export function CreditPurchaseHistory({ tenantId }: CreditPurchaseHistoryProps) {
  const { data: purchases, isLoading } = useQuery({
    queryKey: ['credit-purchases', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_purchases')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('purchased_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!tenantId
  })

  if (isLoading) {
    return (
      <div className="text-sm text-virgilio-muted py-4">
        Loading purchase history...
      </div>
    )
  }

  if (!purchases || purchases.length === 0) {
    return (
      <div className="text-sm text-virgilio-muted py-4 text-center">
        No credit purchases yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-virgilio-border">
            <th className="text-left py-2 px-2 font-medium text-virgilio-muted">Date</th>
            <th className="text-left py-2 px-2 font-medium text-virgilio-muted">Type</th>
            <th className="text-right py-2 px-2 font-medium text-virgilio-muted">Purchased</th>
            <th className="text-right py-2 px-2 font-medium text-virgilio-muted">Remaining</th>
            <th className="text-right py-2 px-2 font-medium text-virgilio-muted">Amount</th>
            <th className="text-left py-2 px-2 font-medium text-virgilio-muted">Status</th>
            <th className="text-left py-2 px-2 font-medium text-virgilio-muted"></th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase) => {
            const isGrant = purchase.bundle_type === 'grant' || purchase.amount_cents === 0
            const isConsumed = purchase.credits_remaining === 0
            const isPartiallyUsed = purchase.credits_remaining > 0 && purchase.credits_remaining < purchase.credits_purchased

            return (
              <tr key={purchase.id} className="border-b border-virgilio-border/50 hover:bg-virgilio-purple/5">
                <td className="py-3 px-2 text-virgilio-text">
                  {purchase.purchased_at
                    ? format(new Date(purchase.purchased_at), 'MMM d, yyyy')
                    : 'N/A'}
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    {isGrant ? (
                      <>
                        <Gift className="h-4 w-4 text-virgilio-success" />
                        <span className="text-virgilio-success">Grant</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 text-virgilio-purple" />
                        <span className="text-virgilio-text">{purchase.bundle_type || 'Bundle'}</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="py-3 px-2 text-right font-medium text-virgilio-text">
                  {purchase.credits_purchased.toLocaleString()}
                </td>
                <td className="py-3 px-2 text-right font-medium text-virgilio-text">
                  {purchase.credits_remaining.toLocaleString()}
                </td>
                <td className="py-3 px-2 text-right text-virgilio-text">
                  {isGrant ? (
                    <span className="text-virgilio-success">Free</span>
                  ) : (
                    `$${(purchase.amount_cents / 100).toFixed(2)}`
                  )}
                </td>
                <td className="py-3 px-2">
                  {isConsumed ? (
                    <Badge variant="outline" className="text-virgilio-muted">Consumed</Badge>
                  ) : isPartiallyUsed ? (
                    <Badge variant="secondary">In Use</Badge>
                  ) : (
                    <Badge variant="default">Active</Badge>
                  )}
                </td>
                <td className="py-3 px-2">
                  {purchase.stripe_payment_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => window.open(`https://dashboard.stripe.com/payments/${purchase.stripe_payment_id}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Stripe
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
