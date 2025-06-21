import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Invoice } from '@/hooks/useInvoices'
import { AlertTriangle } from 'lucide-react'

interface OverduePaymentsCardProps {
  invoices: Invoice[]
}

export function OverduePaymentsCard({ invoices }: OverduePaymentsCardProps) {
  const totalOverdue = useMemo(() => {
    const now = new Date()

    // Filter overdue invoices - no time period filtering needed
    const filteredInvoices = invoices.filter(invoice => {
      const isOverdue = invoice.status === 'overdue' || 
        (invoice.status === 'pending' && invoice.due_date && new Date(invoice.due_date) < now)
      return isOverdue
    })

    // Calculate total amount of overdue invoices
    return filteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  }, [invoices])

  const currency = invoices[0]?.currency || 'USD'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  return (
    <Card className="h-full rounded-2xl" style={{ backgroundColor: '#ffc2c2' }}>
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-black">
              {formatCurrency(totalOverdue)}
            </div>
          </div>
          
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Overdue Payments
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="h-[200px] w-full flex items-center justify-center">
          
        </div>
      </CardContent>
    </Card>
  )
}
