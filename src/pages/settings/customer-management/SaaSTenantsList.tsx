import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Users, Calendar } from 'lucide-react'

export function SaaSTenantsList() {
  // Placeholder data - replace with actual data fetching
  const mockTenants = [
    {
      id: 1,
      name: "Acme Corp",
      status: "active",
      users: 25,
      createdAt: "2024-01-15",
      lastActivity: "2024-03-01"
    },
    {
      id: 2,
      name: "TechStart Inc",
      status: "trial",
      users: 5,
      createdAt: "2024-02-20",
      lastActivity: "2024-02-28"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>SaaS Tenants</CardTitle>
        <CardDescription>
          Manage customer organizations and their subscriptions
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            {mockTenants.map((tenant) => (
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
                    {tenant.users}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {tenant.createdAt}
                  </div>
                </TableCell>
                <TableCell>{tenant.lastActivity}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}