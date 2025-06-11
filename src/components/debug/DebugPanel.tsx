
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { InviteSystemDebug } from './InviteSystemDebug'
import { Bug, User, Shield, Settings, X } from 'lucide-react'

export function DebugPanel() {
  const { user, organizationId, userType, memberRole } = useAuth()
  const permissions = usePermissions()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) {
    return null
  }

  // Compact floating toggle button
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="sm"
          variant="outline"
          className="h-8 w-8 rounded-full p-0 bg-background/80 backdrop-blur-sm border-muted hover:bg-muted/50"
        >
          <Bug className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-hidden">
      <Card className="border-blue-200 bg-blue-50/95 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-blue-800 flex items-center gap-2 text-sm">
                <Bug className="h-4 w-4" />
                Debug Panel
              </CardTitle>
              <CardDescription className="text-blue-600 text-xs">
                Development environment debug information
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 max-h-80 overflow-y-auto">
          <Tabs defaultValue="user" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="user" className="flex items-center gap-1 text-xs">
                <User className="h-3 w-3" />
                User
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-1 text-xs">
                <Shield className="h-3 w-3" />
                Perms
              </TabsTrigger>
              <TabsTrigger value="invites" className="flex items-center gap-1 text-xs">
                <Settings className="h-3 w-3" />
                Invites
              </TabsTrigger>
            </TabsList>

            <TabsContent value="user" className="space-y-3 mt-3">
              <div className="space-y-2">
                <div>
                  <h4 className="font-medium mb-1 text-xs">Authentication</h4>
                  <div className="space-y-1 text-xs">
                    <div><strong>ID:</strong> {user.id.slice(0, 8)}...</div>
                    <div><strong>Email:</strong> {user.email}</div>
                    <div><strong>Type:</strong> <Badge variant="outline" className="text-xs h-4">{userType || 'guest'}</Badge></div>
                    <div><strong>Role:</strong> <Badge variant="outline" className="text-xs h-4">{memberRole || 'none'}</Badge></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-1 text-xs">Organization</h4>
                  <div className="space-y-1 text-xs">
                    <div><strong>Org ID:</strong> {organizationId?.slice(0, 8) || 'None'}...</div>
                    <div><strong>Context:</strong> 
                      <Badge variant={organizationId ? "default" : "secondary"} className="text-xs h-4 ml-1">
                        {organizationId ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-3 mt-3">
              <div className="space-y-2">
                <div>
                  <h4 className="font-medium mb-1 text-xs">User Types</h4>
                  <div className="space-y-1 text-xs">
                    <div>Admin: <Badge variant={permissions.isPlatformAdmin ? "default" : "secondary"} className="text-xs h-4">{permissions.isPlatformAdmin ? 'Yes' : 'No'}</Badge></div>
                    <div>Owner: <Badge variant={permissions.isWorkspaceOwner ? "default" : "secondary"} className="text-xs h-4">{permissions.isWorkspaceOwner ? 'Yes' : 'No'}</Badge></div>
                    <div>Member: <Badge variant={permissions.isMember ? "default" : "secondary"} className="text-xs h-4">{permissions.isMember ? 'Yes' : 'No'}</Badge></div>
                    <div>Client: <Badge variant={permissions.isClient ? "default" : "secondary"} className="text-xs h-4">{permissions.isClient ? 'Yes' : 'No'}</Badge></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-1 text-xs">Permissions</h4>
                  <div className="space-y-1 text-xs">
                    <div>View Members: <Badge variant={permissions.canViewMembers ? "default" : "secondary"} className="text-xs h-4">{permissions.canViewMembers ? 'Yes' : 'No'}</Badge></div>
                    <div>Create Members: <Badge variant={permissions.canCreateMembers ? "default" : "secondary"} className="text-xs h-4">{permissions.canCreateMembers ? 'Yes' : 'No'}</Badge></div>
                    <div>Manage Members: <Badge variant={permissions.canManageMembers ? "default" : "secondary"} className="text-xs h-4">{permissions.canManageMembers ? 'Yes' : 'No'}</Badge></div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="invites" className="mt-3">
              <div className="text-xs">
                <InviteSystemDebug />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
