import { useState } from 'react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Mail, Shield, Building, LogOut, Save, Receipt, Upload, Camera } from 'lucide-react'
import { Section } from '@/components/layout/Section'
import { AppContainer } from '@/components/layout/AppContainer'
import { toast } from '@/hooks/use-toast'
import { InvoicesTable } from '@/components/invoices/InvoicesTable'

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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select a valid image file.',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'File size must be less than 5MB.',
        variant: 'destructive'
      })
      return
    }

    try {
      await uploadAvatar(file)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const timezones = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland'
  ]

  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 
    'Italy', 'Spain', 'Netherlands', 'Australia', 'Japan', 'Other'
  ]

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'
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
                  {/* Avatar Section */}
                  <div className="flex items-center gap-md">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="text-lg">
                        {getInitials(profile?.first_name, profile?.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Label htmlFor="avatar-upload" className="cursor-pointer">
                        <Button variant="outline" size="sm" disabled={profileLoading} asChild>
                          <span className="flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            Change Avatar
                          </span>
                        </Button>
                      </Label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG or GIF. 5MB max.
                      </p>
                    </div>
                  </div>

                  {/* Profile Form */}
                  <div className="grid gap-md md:grid-cols-2">
                    <div>
                      <Label htmlFor="first-name">First Name</Label>
                      <Input
                        id="first-name"
                        value={profileFormData.first_name}
                        onChange={(e) => setProfileFormData(prev => ({ ...prev, first_name: e.target.value }))}
                        placeholder="Enter first name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input
                        id="last-name"
                        value={profileFormData.last_name}
                        onChange={(e) => setProfileFormData(prev => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Enter last name"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="title">Job Title</Label>
                      <Input
                        id="title"
                        value={profileFormData.title}
                        onChange={(e) => setProfileFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter job title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profileFormData.phone}
                        onChange={(e) => setProfileFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Enter phone number"
                      />
                    </div>

                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select 
                        value={profileFormData.timezone} 
                        onValueChange={(value) => setProfileFormData(prev => ({ ...prev, timezone: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {timezones.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="linkedin">LinkedIn URL</Label>
                      <Input
                        id="linkedin"
                        value={profileFormData.linkedin_url}
                        onChange={(e) => setProfileFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                        placeholder="https://linkedin.com/in/yourprofile"
                      />
                    </div>
                  </div>

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
