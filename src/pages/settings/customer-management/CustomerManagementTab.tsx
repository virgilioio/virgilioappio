import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Building, DollarSign, Activity } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

export function CustomerManagementTab() {
  const isLoading = false
  const metrics = {
    totalCustomers: 0,
    activeTenants: 0,
    monthlyRevenue: 0,
    totalActiveUsers: 0
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Customer Management" 
        subtitle="Overview of SaaS customers and platform metrics"
      />
      
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
      
      <Card>
        <CardHeader>
          <CardTitle>Legacy Customer Management</CardTitle>
          <CardDescription>
            This is the legacy customer management interface. Please use the new SaaS Customers tab in Platform settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Legacy customer management features have been moved to the new SaaS customer management system.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}