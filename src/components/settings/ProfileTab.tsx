
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, Mail, Shield, Save } from 'lucide-react'
import { AvatarUploader } from './AvatarUploader'
import { ProfileForm } from './ProfileForm'

interface ProfileFormData {
  first_name: string
  last_name: string
  title: string
  phone: string
  linkedin_url: string
  timezone: string
}

export function ProfileTab() {
  const { user } = useAuth()
  const { profile, updateMyProfile, uploadAvatar, isLoading: profileLoading } = useUserProfile()
  
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
      await updateMyProfile(profileFormData)
      setLastUpdated(new Date().toLocaleString())
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
    <div className="space-y-6">
      {/* Profile Information Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Manage your personal information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="pb-6 border-b border-border">
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="heading-sm font-semibold">Personal Information</h4>
              {lastUpdated && (
                <span className="text-sm text-text-secondary">
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
          <div className="flex justify-end pt-4 border-t border-border">
            <Button 
              onClick={handleProfileSave} 
              disabled={profileLoading || !hasChanges}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Information Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            View your account details and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 text-md text-text-secondary">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4" />
              <span>Email: {user?.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4" />
              <span>User Type: </span>
              <Badge variant="secondary">
                {user?.user_metadata?.user_type || 'guest'}
              </Badge>
            </div>
            {user?.user_metadata?.member_role && (
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4" />
                <span>Member Role: </span>
                <Badge variant="outline">
                  {user.user_metadata.member_role}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
