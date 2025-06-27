
import React from 'react'
import { useInvoices } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { TotalPaidCard } from './TotalPaidCard'
import { OverduePaymentsCard } from './OverduePaymentsCard'
import { OutstandingBalanceCard } from './OutstandingBalanceCard'

export function BillingMetricsDashboard() {
  const { invoices, isLoading, error } = useInvoices()
  const { canViewBilling } = usePermissions()

  if (!canViewBilling) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view billing information.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load billing metrics. Please try again.
        </AlertDescription>
      </Alert>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No invoices found. Create your first invoice to see billing metrics.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TotalPaidCard invoices={invoices} />
        <OverduePaymentsCard invoices={invoices} />
        <OutstandingBalanceCard invoices={invoices} />
      </div>
    </div>
  )
}
