
import { useState } from 'react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Mail, Shield, Building, LogOut, Save, Receipt } from 'lucide-react'
import { Section } from '@/components/layout/Section'
import { AppContainer } from '@/components/layout/AppContainer'
import { toast } from '@/hooks/use-toast'
import { InvoicesTable } from '@/components/invoices/InvoicesTable'

export default function Settings() {
  const { user, logout } = useAuth()
  const { organizations, updateOrganization, isLoading } = useOrganizations()
  
  // Get the first organization for demo purposes - in a real app this would be based on user's organization
  const userOrganization = organizations?.[0]
  
  const [orgFormData, setOrgFormData] = useState({
    name: userOrganization?.name || '',
    country: userOrganization?.country || '',
    status: userOrganization?.status || 'active'
  })

  const handleLogout = async () => {
    try {
      await logout()
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleOrgSave = async () => {
    if (!userOrganization?.id) {
      toast({
        title: 'Error',
        description: 'No organization found to update.',
        variant: 'destructive'
      })
      return
    }

    try {
      await updateOrganization(userOrganization.id, orgFormData)
      toast({
        title: 'Success',
        description: 'Organization settings updated successfully.'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update organization settings.',
        variant: 'destructive'
      })
    }
  }

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 
    'Italy', 'Spain', 'Netherlands', 'Australia', 'Japan', 'Other'
  ]

  return (
    <AuthGate>
      <Section>
        <AppContainer>
          <div className="mb-layout-lg">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Settings</h1>
            <p className="text-text-secondary mt-sm">
              Manage your account settings and organization preferences
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-layout-md">
            <TabsList className="grid w-full grid-cols-3 max-w-lg">
              <TabsTrigger value="profile">My Profile</TabsTrigger>
              <PermissionGate permission="canManageOrganization">
                <TabsTrigger value="organization">Organization</TabsTrigger>
              </PermissionGate>
              <PermissionGate permission="canViewBilling">
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </PermissionGate>
            </TabsList>

            <TabsContent value="profile" className="space-y-layout-md">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Your account details and role information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-md">
                  <div className="grid gap-md">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Email:</Label>
                      <span className="text-sm text-muted-foreground">{user?.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">User Type:</Label>
                      <Badge variant="secondary">
                        {user?.user_metadata?.user_type || 'guest'}
                      </Badge>
                    </div>
                    
                    {user?.user_metadata?.member_role && (
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Member Role:</Label>
                        <Badge variant="outline">
                          {user.user_metadata.member_role}
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Status:</Label>
                      <Badge variant="default">
                        Active
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-md border-t">
                    <Button 
                      variant="destructive" 
                      onClick={handleLogout}
                      className="flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <PermissionGate permission="canManageOrganization">
              <TabsContent value="organization" className="space-y-layout-md">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Organization Settings
                    </CardTitle>
                    <CardDescription>
                      Manage your organization details and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-md">
                    {userOrganization ? (
                      <div className="space-y-md">
                        <div className="grid gap-md">
                          <div>
                            <Label htmlFor="org-name">Organization Name</Label>
                            <Input
                              id="org-name"
                              value={orgFormData.name}
                              onChange={(e) => setOrgFormData(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Enter organization name"
                            />
                          </div>

                          <div>
                            <Label htmlFor="org-country">Country</Label>
                            <Select 
                              value={orgFormData.country} 
                              onValueChange={(value) => setOrgFormData(prev => ({ ...prev, country: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                              <SelectContent>
                                {countries.map((country) => (
                                  <SelectItem key={country} value={country}>
                                    {country}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="org-status">Status</Label>
                            <Select 
                              value={orgFormData.status} 
                              onValueChange={(value) => setOrgFormData(prev => ({ ...prev, status: value as 'active' | 'inactive' }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="pt-md border-t">
                          <div className="grid gap-sm text-sm text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Organization ID:</span>
                              <code className="text-xs">{userOrganization.id}</code>
                            </div>
                            <div className="flex justify-between">
                              <span>Created:</span>
                              <span>{new Date(userOrganization.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end pt-md">
                          <Button 
                            onClick={handleOrgSave} 
                            disabled={isLoading}
                            className="flex items-center gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {isLoading ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-layout-md">
                        <p className="text-muted-foreground">No organization found.</p>
                        <p className="text-sm text-muted-foreground mt-sm">
                          Contact your administrator to set up an organization.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </PermissionGate>

            <PermissionGate permission="canViewBilling">
              <TabsContent value="billing" className="space-y-layout-md">
                <InvoicesTable />
              </TabsContent>
            </PermissionGate>
          </Tabs>
        </AppContainer>
      </Section>
    </AuthGate>
  )
}
