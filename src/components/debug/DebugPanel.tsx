
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { InviteSystemDebug } from './InviteSystemDebug'
import { Bug, User, Shield, Settings } from 'lucide-react'

export function DebugPanel() {
  const { user, organizationId, userType, memberRole } = useAuth()
  const permissions = usePermissions()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!user) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-800 flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug Panel - Not Authenticated
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Debug Panel
            </CardTitle>
            <CardDescription className="text-blue-600">
              Development environment debug information
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          <Tabs defaultValue="user" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="user" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                User Info
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissions
              </TabsTrigger>
              <TabsTrigger value="invites" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Invite System
              </TabsTrigger>
            </TabsList>

            <TabsContent value="user" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Authentication</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>User ID:</strong> {user.id}</div>
                    <div><strong>Email:</strong> {user.email}</div>
                    <div><strong>User Type:</strong> <Badge variant="outline">{userType || 'guest'}</Badge></div>
                    <div><strong>Member Role:</strong> <Badge variant="outline">{memberRole || 'none'}</Badge></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Organization Context</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Organization ID:</strong> {organizationId || 'None'}</div>
                    <div><strong>Has Org Context:</strong> 
                      <Badge variant={organizationId ? "default" : "secondary"}>
                        {organizationId ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium mb-2">User Types</h4>
                  <div className="space-y-1 text-sm">
                    <div>Platform Admin: <Badge variant={permissions.isPlatformAdmin ? "default" : "secondary"}>{permissions.isPlatformAdmin ? 'Yes' : 'No'}</Badge></div>
                    <div>Workspace Owner: <Badge variant={permissions.isWorkspaceOwner ? "default" : "secondary"}>{permissions.isWorkspaceOwner ? 'Yes' : 'No'}</Badge></div>
                    <div>Member: <Badge variant={permissions.isMember ? "default" : "secondary"}>{permissions.isMember ? 'Yes' : 'No'}</Badge></div>
                    <div>Client: <Badge variant={permissions.isClient ? "default" : "secondary"}>{permissions.isClient ? 'Yes' : 'No'}</Badge></div>
                    <div>Guest: <Badge variant={permissions.isGuest ? "destructive" : "secondary"}>{permissions.isGuest ? 'Yes' : 'No'}</Badge></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Member Permissions</h4>
                  <div className="space-y-1 text-sm">
                    <div>View Members: <Badge variant={permissions.canViewMembers ? "default" : "secondary"}>{permissions.canViewMembers ? 'Yes' : 'No'}</Badge></div>
                    <div>Create Members: <Badge variant={permissions.canCreateMembers ? "default" : "secondary"}>{permissions.canCreateMembers ? 'Yes' : 'No'}</Badge></div>
                    <div>Manage Members: <Badge variant={permissions.canManageMembers ? "default" : "secondary"}>{permissions.canManageMembers ? 'Yes' : 'No'}</Badge></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Organization Permissions</h4>
                  <div className="space-y-1 text-sm">
                    <div>View Organizations: <Badge variant={permissions.canViewOrganizations ? "default" : "secondary"}>{permissions.canViewOrganizations ? 'Yes' : 'No'}</Badge></div>
                    <div>Manage Organization: <Badge variant={permissions.canManageOrganization ? "default" : "secondary"}>{permissions.canManageOrganization ? 'Yes' : 'No'}</Badge></div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="invites">
              <InviteSystemDebug />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  )
}
