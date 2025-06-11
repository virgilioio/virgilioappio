
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, TrendingUp, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'

export function PaymentsTracker() {
  const { invoices, isLoading } = useInvoices()
  const [paymentsDue, setPaymentsDue] = useState(0)
  const [incomingPayments, setIncomingPayments] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (invoices) {
      const pending = invoices.filter(invoice => invoice.status === 'pending')
      const paymentsDueAmount = pending.reduce((sum, invoice) => sum + (invoice.amount || 0), 0)
      
      setPaymentsDue(paymentsDueAmount)
      setIncomingPayments(paymentsDueAmount) // For now, same as payments due
      setPendingCount(pending.length)
    }
  }, [invoices])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payments Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Payments Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-text-secondary">Payments Due</p>
            <p className="text-2xl font-semibold text-text-primary">
              ${paymentsDue.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-text-secondary">Incoming</p>
            <p className="text-2xl font-semibold text-success">
              ${incomingPayments.toLocaleString()}
            </p>
          </div>
        </div>
        
        {pendingCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{pendingCount}</Badge>
              <span className="text-sm text-text-secondary">pending invoices</span>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings?tab=billing" className="flex items-center gap-1">
                View all
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
