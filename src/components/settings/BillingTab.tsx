
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt } from 'lucide-react'
import { InvoicesTable } from '@/components/invoices/InvoicesTable'

export function BillingTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <Receipt className="h-5 w-5" />
            Billing & Invoices
          </CardTitle>
          <CardDescription>
            View and manage your billing information and invoice history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicesTable />
        </CardContent>
      </Card>
    </div>
  )
}
