
import { useInvoices } from '@/hooks/useInvoices'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { useInvoiceFilter } from '@/utils/invoiceFilters'
import { useAdminMetrics } from '@/hooks/useAdminMetrics'
import { useClientMetrics } from '@/hooks/useClientMetrics'
import { MetricCard } from './MetricCard'

export function BillingMetricsDashboard() {
  const { invoices } = useInvoices()
  const { canManageInvoices, canViewBilling } = usePermissions()
  const { organizationId } = useAuth()
  const { filters } = useInvoiceFilter()

  // Don't render if user can't view billing
  if (!canViewBilling) {
    return null
  }

  // Base filtering based on role
  const baseInvoices = canManageInvoices 
    ? invoices // Admin/Billing sees all
    : invoices.filter(invoice => invoice.organization_id === organizationId) // Scoped to org

  const adminMetrics = useAdminMetrics(baseInvoices, filters)
  const clientMetrics = useClientMetrics(baseInvoices, filters)

  const metrics = canManageInvoices ? adminMetrics : clientMetrics

  if (metrics.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            tooltip={metric.tooltip}
            variant={metric.variant}
          />
        ))}
      </div>
    </div>
  )
}
