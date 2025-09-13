import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePlatformMetrics } from '@/hooks/usePlatformMetrics'
import { 
  Users, 
  Building2, 
  Briefcase, 
  UserCheck, 
  Receipt, 
  Activity,
  TrendingUp,
  Database,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function PlatformDashboard() {
  const { data: metrics, isLoading, error } = usePlatformMetrics()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Platform Dashboard</h2>
          <p className="text-muted-foreground">Monitor platform-wide metrics and system health</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Platform Dashboard</h2>
          <p className="text-muted-foreground">Monitor platform-wide metrics and system health</p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Failed to load platform metrics: {error.message}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Platform Dashboard</h2>
        <p className="text-muted-foreground">Monitor platform-wide metrics and system health</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.users.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.organizations.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.organizations.clients || 0} clients
            </p>
          </CardContent>
        </Card>

        {/* Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.jobs.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.jobs.active || 0} active • {metrics?.jobs.draft || 0} draft
            </p>
          </CardContent>
        </Card>

        {/* Candidates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.candidates.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.candidates.independent || 0} independent
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth & Activity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Monthly Growth */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">New Jobs</span>
                <span className="font-semibold">{metrics?.jobs.newThisMonth || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">New Candidates</span>
                <span className="font-semibold">{metrics?.candidates.newThisMonth || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activity.recentActivities || 0}</div>
            <p className="text-xs text-muted-foreground">
              Activities in last 7 days
            </p>
          </CardContent>
        </Card>

        {/* Invoice Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.invoices.recent || 0}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="default" className="text-xs">
                {metrics?.invoices.paid || 0} paid
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {metrics?.invoices.pending || 0} pending
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CoreSignal API card removed */}

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Database</span>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Online
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Edge Functions</span>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Operational
                  </Badge>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Last check: {metrics?.lastUpdated ? 
                  new Date(metrics.lastUpdated).toLocaleString() : 
                  'Just now'
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}