
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { Building2, User, AlertTriangle, Calendar } from 'lucide-react'

export function OrganizationDebug() {
  const { organizations, isLoading } = useOrganizations()
  const permissions = usePermissions()

  const organizationsWithoutOwner = organizations.filter(org => !org.owner_id)
  const recentOrganizations = organizations.slice(0, 3)

  return (
    <div className="space-y-3">
      {/* Permission Status */}
      <div>
        <h4 className="font-medium mb-2 text-xs flex items-center gap-1">
          <User className="h-3 w-3" />
          Organization Permissions
        </h4>
        <div className="space-y-1 text-xs">
          <div>Can Manage: <Badge variant={permissions.canManageOrganization ? "default" : "secondary"} className="text-xs h-4">{permissions.canManageOrganization ? 'Yes' : 'No'}</Badge></div>
          <div>Can Create: <Badge variant={permissions.canCreateOrganizations ? "default" : "secondary"} className="text-xs h-4">{permissions.canCreateOrganizations ? 'Yes' : 'No'}</Badge></div>
          <div>Can Edit: <Badge variant={permissions.canEditOrganizations ? "default" : "secondary"} className="text-xs h-4">{permissions.canEditOrganizations ? 'Yes' : 'No'}</Badge></div>
          <div>Can Delete: <Badge variant={permissions.canDeleteOrganizations ? "default" : "secondary"} className="text-xs h-4">{permissions.canDeleteOrganizations ? 'Yes' : 'No'}</Badge></div>
        </div>
      </div>

      {/* Recent Organizations */}
      <div>
        <h4 className="font-medium mb-2 text-xs flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          Recent Organizations ({organizations.length} total)
        </h4>
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading...</div>
        ) : recentOrganizations.length > 0 ? (
          <div className="space-y-2">
            {recentOrganizations.map((org) => (
              <div key={org.id} className="text-xs border rounded p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{org.name}</span>
                  <Badge variant={org.status === 'active' ? "default" : "secondary"} className="text-xs h-4">
                    {org.status}
                  </Badge>
                </div>
                <div className="text-muted-foreground">
                  <div>Type: {org.organization_type}</div>
                  <div>Country: {org.country}</div>
                  {org.owner_email && <div>Owner: {org.owner_email}</div>}
                  {org.created_by_email && <div>Created by: {org.created_by_email}</div>}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-2 w-2" />
                    {new Date(org.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No organizations found</div>
        )}
      </div>

      {/* Organizations without owners */}
      {organizationsWithoutOwner.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-xs flex items-center gap-1 text-yellow-600">
            <AlertTriangle className="h-3 w-3" />
            Organizations Missing Owner ({organizationsWithoutOwner.length})
          </h4>
          <div className="space-y-1">
            {organizationsWithoutOwner.map((org) => (
              <div key={org.id} className="text-xs text-yellow-600">
                • {org.name} ({org.country})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
