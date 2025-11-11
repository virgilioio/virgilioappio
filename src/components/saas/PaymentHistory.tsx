import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Download, CheckCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

interface PaymentHistoryProps {
  stripeCustomerId: string | null
}

interface StripeInvoice {
  id: string
  amount: number
  currency: string
  status: string
  created: number
  invoice_pdf?: string
  hosted_invoice_url?: string
  period_start: number
  period_end: number
}

export function PaymentHistory({ stripeCustomerId }: PaymentHistoryProps) {
  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['stripe-invoices', stripeCustomerId],
    queryFn: async (): Promise<StripeInvoice[]> => {
      if (!stripeCustomerId) return []
      
      const { data, error } = await supabase.functions.invoke('get-stripe-invoices', {
        body: { customerId: stripeCustomerId, limit: 10 },
      })

      if (error) throw error
      return data?.invoices || []
    },
    enabled: !!stripeCustomerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-success" />
      case 'open':
        return <Clock className="h-4 w-4 text-warning" />
      case 'void':
      case 'uncollectible':
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'paid':
        return 'default'
      case 'open':
        return 'secondary'
      case 'void':
      case 'uncollectible':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  if (!stripeCustomerId) {
    return (
      <Card className="shadow-calendly border-virgilio-border">
        <CardHeader>
          <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
            Payment History<span className="text-virgilio-purple">.</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-virgilio-muted">
            No Stripe customer ID available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-calendly border-virgilio-border">
      <CardHeader>
        <CardTitle className="text-h4-mobile md:text-h4-desktop font-poppins font-bold text-virgilio-text">
          Payment History<span className="text-virgilio-purple">.</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            Failed to load payment history: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : invoices && invoices.length > 0 ? (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-virgilio-border rounded-lg hover:border-virgilio-purple/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(invoice.status)}
                  <div>
                    <div className="font-medium text-virgilio-text">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </div>
                    <div className="text-sm text-virgilio-muted">
                      {format(new Date(invoice.created * 1000), 'MMM d, yyyy')}
                      {invoice.period_start && invoice.period_end && (
                        <span className="ml-2">
                          ({format(new Date(invoice.period_start * 1000), 'MMM d')} -{' '}
                          {format(new Date(invoice.period_end * 1000), 'MMM d')})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(invoice.status)} className="capitalize">
                    {invoice.status}
                  </Badge>
                  
                  {invoice.hosted_invoice_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.open(invoice.hosted_invoice_url, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </Button>
                  )}
                  
                  {invoice.invoice_pdf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.open(invoice.invoice_pdf, '_blank')}
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-virgilio-muted">
            No payment history available
          </div>
        )}
      </CardContent>
    </Card>
  )
}
