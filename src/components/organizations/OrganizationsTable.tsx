
import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit, Trash2, Building2, User, Calendar } from 'lucide-react'
import { Organization } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { Skeleton } from '@/components/ui/skeleton'

interface OrganizationsTableProps {
  organizations: Organization[]
  isLoading: boolean
  onEdit: (organization: Organization) => void
  onDelete: (id: string) => void
  onCreateNew?: () => void
}

export function OrganizationsTable({
  organizations,
  isLoading,
  onEdit,
  onDelete,
  onCreateNew
}: OrganizationsTableProps) {
  const permissions = usePermissions()

  // Helper function to display owner information with fallback
  const displayOwnerInfo = (org: Organization) => {
    if (org.owner_email) {
      return (
        <div className="flex items-center gap-1 text-sm">
          <User className="h-3 w-3" />
          {org.owner_email}
        </div>
      )
    }
    
    if (org.owner_id) {
      return (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <User className="h-3 w-3" />
          User ID: {org.owner_id.slice(0, 8)}...
        </div>
      )
    }
    
    return <span className="text-muted-foreground text-sm">No owner</span>
  }

  // Helper function to display creator information with fallback
  const displayCreatorInfo = (org: Organization) => {
    if (org.created_by_email) {
      return <span className="text-sm">{org.created_by_email}</span>
    }
    
    if (org.created_by) {
      return (
        <span className="text-sm text-muted-foreground">
          User ID: {org.created_by.slice(0, 8)}...
        </span>
      )
    }
    
    return <span className="text-muted-foreground text-sm">Unknown</span>
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organizations
              </CardTitle>
              <CardDescription>Manage client organizations</CardDescription>
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizations
            </CardTitle>
            <CardDescription>
              Manage client organizations and their settings
            </CardDescription>
          </div>
          {permissions.canCreateOrganizations && onCreateNew && (
            <Button onClick={onCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Organization
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {organizations.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first organization to get started.
            </p>
            {permissions.canCreateOrganizations && onCreateNew && (
              <Button onClick={onCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Organization
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id} interactive onClick={() => onEdit(org)}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{org.country}</TableCell>
                    <TableCell>
                      <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {org.organization_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {displayOwnerInfo(org)}
                    </TableCell>
                    <TableCell>
                      {displayCreatorInfo(org)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(org.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {permissions.canEditOrganizations && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); onEdit(org); }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {permissions.canDeleteOrganizations && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); onDelete(org.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
