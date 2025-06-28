
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Receipt, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'

export function PaymentHistory() {
  const { invoices, isLoading } = useInvoices()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const paidInvoices = invoices
    ?.filter(invoice => invoice.status === 'paid')
    ?.sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime())
    ?.slice(0, 3) || []

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {paidInvoices.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No payment history yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paidInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="space-y-1 flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {invoice.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Paid on {new Date(invoice.paid_at || invoice.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-semibold text-foreground">
                    {formatCurrency(invoice.amount)}
                  </div>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    Paid
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="pt-2 border-t border-border">
          <Link to="/settings?tab=billing">
            <Button variant="ghost" size="sm" className="w-full text-sm">
              View all payments
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
