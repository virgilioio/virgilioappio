
import { useState } from 'react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Mail, Shield, Building, LogOut, Save } from 'lucide-react'
import { Section } from '@/components/layout/Section'
import { AppContainer } from '@/components/layout/AppContainer'
import { toast } from '@/hooks/use-toast'
import { InvoicesTable } from '@/components/invoices/InvoicesTable'
import { AvatarUploader } from '@/components/settings/AvatarUploader'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { OrganizationForm } from '@/components/settings/OrganizationForm'

export default function Settings() {
  const { user, logout } = useAuth()
  const { organizations, updateOrganization, isLoading } = useOrganizations()
  const { profile, updateMyProfile, uploadAvatar, isLoading: profileLoading } = useUserProfile()
  
  // Get the first organization for demo purposes - in a real app this would be based on user's organization
  const userOrganization = organizations?.[0]
  
  const [orgFormData, setOrgFormData] = useState({
    name: userOrganization?.name || '',
    country: userOrganization?.country || '',
    status: userOrganization?.status || 'active'
  })

  const [profileFormData, setProfileFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    title: profile?.title || '',
    phone: profile?.phone || '',
    linkedin_url: profile?.linkedin_url || '',
    timezone: profile?.timezone || 'UTC'
  })

  // Update form data when profile loads
  useState(() => {
    if (profile) {
      setProfileFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        title: profile.title || '',
        phone: profile.phone || '',
        linkedin_url: profile.linkedin_url || '',
        timezone: profile.timezone || 'UTC'
      })
    }
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

  const handleProfileSave = async () => {
    try {
      await updateMyProfile(profileFormData)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleAvatarUpload = async (file: File) => {
    await uploadAvatar(file)
  }

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
                    Manage your personal information and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-md">
                  <AvatarUploader
                    avatarUrl={profile?.avatar_url}
                    firstName={profile?.first_name}
                    lastName={profile?.last_name}
                    userEmail={user?.email}
                    isLoading={profileLoading}
                    onUpload={handleAvatarUpload}
                  />

                  <ProfileForm
                    formData={profileFormData}
                    onFormDataChange={setProfileFormData}
                  />

                  {/* Account Info */}
                  <div className="pt-md border-t space-y-sm">
                    <h4 className="font-semibold">Account Information</h4>
                    <div className="grid gap-sm text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>Email: {user?.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>User Type: </span>
                        <Badge variant="secondary">
                          {user?.user_metadata?.user_type || 'guest'}
                        </Badge>
                      </div>
                      {user?.user_metadata?.member_role && (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <span>Member Role: </span>
                          <Badge variant="outline">
                            {user.user_metadata.member_role}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-md border-t">
                    <Button 
                      variant="destructive" 
                      onClick={handleLogout}
                      className="flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>

                    <Button 
                      onClick={handleProfileSave} 
                      disabled={profileLoading}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {profileLoading ? 'Saving...' : 'Save Changes'}
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
                  <CardContent>
                    <OrganizationForm
                      organization={userOrganization}
                      formData={orgFormData}
                      onFormDataChange={setOrgFormData}
                      onSave={handleOrgSave}
                      isLoading={isLoading}
                    />
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
