import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Users, Calendar, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSaaSTenants } from '@/hooks/useSaaSTenants'
import { format } from 'date-fns'

export function SaaSTenantsList() {
  const { data: tenants, isLoading, error } = useSaaSTenants()

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SaaS Tenants</CardTitle>
          <CardDescription>Error loading customer data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load SaaS customers: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SaaS Tenants</CardTitle>
        <CardDescription>
          Manage customer organizations and their subscriptions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading SaaS customers...</span>
          </div>
        ) : !tenants || tenants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No SaaS customers found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>
                    <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                      {tenant.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {tenant.user_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(tenant.created_at), 'MMM dd, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {tenant.last_activity 
                      ? format(new Date(tenant.last_activity), 'MMM dd, yyyy')
                      : 'No activity'
                    }
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/settings?tab=platform-customers&view=customers/${tenant.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}