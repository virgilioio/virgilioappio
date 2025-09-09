import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Building, DollarSign, Activity } from 'lucide-react'
import { SaaSTenantsList } from './SaaSTenantsList'
import { useSaaSMetrics } from '@/hooks/useSaaSMetrics'

export function CustomerManagementTab() {
  const { data: metrics, isLoading } = useSaaSMetrics()

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '--' : metrics?.totalCustomers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Loading...' : 'SaaS customers'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '--' : metrics?.activeTenants || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Loading...' : 'Active organizations'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '--' : `$${(metrics?.monthlyRevenue || 0).toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Loading...' : 'Estimated revenue'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '--' : metrics?.totalActiveUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Loading...' : 'Across all tenants'}
            </p>
          </CardContent>
        </Card>
      </div>
      
      <SaaSTenantsList />
    </div>
  )
}