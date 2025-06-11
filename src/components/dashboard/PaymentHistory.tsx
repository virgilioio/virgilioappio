
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
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    )
  }

  const paidInvoices = invoices
    ?.filter(invoice => invoice.status === 'paid')
    ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    ?.slice(0, 3) || []

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
          <div className="text-center py-4 text-text-secondary">
            No payment history yet
          </div>
        ) : (
          <div className="space-y-3">
            {paidInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {invoice.title}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    ${invoice.amount?.toLocaleString()}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Paid
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <Button variant="ghost" size="sm" asChild className="w-full">
          <Link to="/settings?tab=billing" className="flex items-center gap-1">
            View all payments
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
