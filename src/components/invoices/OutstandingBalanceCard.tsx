
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Invoice } from '@/hooks/useInvoices'
import { Clock } from 'lucide-react'

interface OutstandingBalanceCardProps {
  invoices: Invoice[]
}

export function OutstandingBalanceCard({ invoices }: OutstandingBalanceCardProps) {
  const totalOutstanding = useMemo(() => {
    const now = new Date()

    // Filter outstanding invoices (pending + overdue) - no time period filtering needed
    const filteredInvoices = invoices.filter(invoice => {
      const isOverdue = invoice.status === 'overdue' || 
        (invoice.status === 'pending' && invoice.due_date && new Date(invoice.due_date) < now)
      const isPending = invoice.status === 'pending'
      return isOverdue || isPending
    })

    // Calculate total amount of outstanding invoices
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
    <Card className="h-full rounded-2xl" style={{ backgroundColor: '#d7c5fb' }}>
      <CardHeader className="pb-2">
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-black">
              {formatCurrency(totalOutstanding)}
            </div>
          </div>
          
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Outstanding Balance
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
