
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { User, Mail, Shield, Save } from 'lucide-react'
import { AvatarUploader } from './AvatarUploader'
import { ProfileForm } from './ProfileForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { GoogleWorkspaceIntegrationSection } from './GoogleWorkspaceIntegrationSection'
import { ChromeExtensionTokenCard } from './ChromeExtensionTokenCard'
import { BookingLinkSection } from './BookingLinkSection'

interface ProfileFormData {
  first_name: string
  last_name: string
  title: string
  phone: string
  linkedin_url: string
  timezone: string
}

export function ProfileTab() {
  const { user, userType, memberRole } = useAuth()
  const { profile, updateProfile, uploadAvatar, isLoading: profileLoading } = useUserProfile()
  const queryClient = useQueryClient()
  
  const [profileFormData, setProfileFormData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    title: '',
    phone: '',
    linkedin_url: '',
    timezone: 'UTC'
  })
  
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  // Update form data when profile loads
  useEffect(() => {
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
  }, [profile])

  const handleProfileSave = async () => {
    try {
      const hadNoNames = !profile?.first_name || !profile?.last_name
      const nowHasNames = profileFormData.first_name && profileFormData.last_name
      
      await updateProfile(profileFormData)
      setLastUpdated(new Date().toLocaleString())
      
      // If user just completed their profile, trigger booking config creation
      if (hadNoNames && nowHasNames) {
        queryClient.invalidateQueries({ queryKey: ['booking-config'] })
      }
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleAvatarUpload = async (file: File) => {
    await uploadAvatar(file)
    setLastUpdated(new Date().toLocaleString())
  }

  // Check if form has changes
  const hasChanges = profile && (
    profileFormData.first_name !== (profile.first_name || '') ||
    profileFormData.last_name !== (profile.last_name || '') ||
    profileFormData.title !== (profile.title || '') ||
    profileFormData.phone !== (profile.phone || '') ||
    profileFormData.linkedin_url !== (profile.linkedin_url || '') ||
    profileFormData.timezone !== (profile.timezone || 'UTC')
  )

  return (
    <div className="space-y-md">
      <PageHeader 
        title="Profile" 
        subtitle="Manage your personal information and preferences"
      />
      
      {/* Profile Information Card */}
      <Card data-onboarding-target="profile">
        <CardHeader className="pb-sm">
          <CardTitle className="flex items-center gap-2 text-lg font-poppins font-bold text-virgilio-text tracking-page-title">
            <User className="h-4 w-4 text-virgilio-purple" />
            Profile Information<span className="text-purple-period">.</span>
          </CardTitle>
          <CardDescription className="text-xs text-virgilio-muted">
            Manage your personal information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-md">
          {/* Avatar Section */}
          <div className="pb-md border-b border-border">
            <AvatarUploader
              avatarUrl={profile?.avatar_url}
              firstName={profile?.first_name}
              lastName={profile?.last_name}
              userEmail={user?.email}
              isLoading={profileLoading}
              onUpload={handleAvatarUpload}
            />
          </div>

          {/* Profile Form */}
          <div className="space-y-sm" id="profile-form">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Personal Information</h4>
              {lastUpdated && (
                <span className="text-xs text-text-secondary">
                  Last updated: {lastUpdated}
                </span>
              )}
            </div>
            
            <ProfileForm
              formData={profileFormData}
              onFormDataChange={setProfileFormData}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-sm border-t border-border">
            <Button 
              onClick={handleProfileSave} 
              disabled={profileLoading || !hasChanges}
              className="flex items-center gap-2"
              size="sm"
            >
              <Save className="h-3 w-3" />
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />
      
      <GoogleWorkspaceIntegrationSection />
      
      <Separator className="my-8" />

      <ChromeExtensionTokenCard />
      
      <Separator className="my-8" />

      <BookingLinkSection />
      
      <Separator className="my-8" />
      
      {/* Account Information Card */}
      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="flex items-center gap-2 text-lg font-poppins font-bold text-virgilio-text tracking-page-title">
            <Shield className="h-4 w-4 text-virgilio-purple" />
            Account Information<span className="text-purple-period">.</span>
          </CardTitle>
          <CardDescription className="text-xs text-virgilio-muted">
            View your account details and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-sm">
          <div className="grid gap-sm text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              <span>Email: {user?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3" />
              <span>User Type: </span>
              <Badge variant="secondary" className="text-xs">
                {userType || 'none'}
              </Badge>
            </div>
            {memberRole && (
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                <span>Member Role: </span>
                <Badge variant="outline" className="text-xs">
                  {memberRole}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
