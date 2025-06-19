
import { useState, useEffect } from 'react'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building } from 'lucide-react'
import { OrganizationForm } from './OrganizationForm'
import { useAuth } from '@/contexts/AuthContext'

interface OrganizationFormData {
  name: string
  country: string
  status: 'active' | 'inactive'
  billing_poc_user_id: string | null
  billing_poc_additional_email: string
  billing_poc_phone: string
}

export function OrganizationTab() {
  const { organizations, updateOrganization, isLoading, error } = useOrganizations()
  const { userType, user } = useAuth()
  
  console.log('OrganizationTab render - organizations:', organizations, 'isLoading:', isLoading, 'error:', error, 'userType:', userType)
  
  // Get the user's organization - prioritize owned organizations for both workspace owners and platform admins
  const getUserOrganization = () => {
    if (!organizations || organizations.length === 0) {
      console.log('OrganizationTab getUserOrganization - no organizations available')
      return null
    }
    
    // For both workspace owners and platform admins, prioritize organizations they own
    if ((userType === 'workspace_owner' || userType === 'platform_admin') && user) {
      console.log('OrganizationTab getUserOrganization - checking for owned organizations for user:', user.id, 'userType:', userType)
      
      const ownedOrganization = organizations.find(org => org.owner_id === user.id)
      if (ownedOrganization) {
        console.log('OrganizationTab getUserOrganization - found owned organization:', ownedOrganization.name, 'id:', ownedOrganization.id)
        return ownedOrganization
      }
      
      console.log('OrganizationTab getUserOrganization - no owned organization found for user:', user.id)
      
      // For workspace owners without owned organizations, this might indicate a data issue
      if (userType === 'workspace_owner') {
        console.warn('OrganizationTab getUserOrganization - workspace owner has no owned organization, this may indicate a data issue')
      }
      
      // For platform admins, fallback to first organization if no owned organization found
      if (userType === 'platform_admin') {
        console.log('OrganizationTab getUserOrganization - platform admin fallback to first available organization')
        return organizations[0]
      }
    }
    
    // For other user types or fallback case, use first organization
    console.log('OrganizationTab getUserOrganization - using first available organization for userType:', userType)
    return organizations[0]
  }
  
  const userOrganization = getUserOrganization()
  console.log('OrganizationTab - selected userOrganization:', userOrganization?.name, 'id:', userOrganization?.id, 'owner_id:', userOrganization?.owner_id)
  
  const [orgFormData, setOrgFormData] = useState<OrganizationFormData>({
    name: '',
    country: '',
    status: 'active',
    billing_poc_user_id: null,
    billing_poc_additional_email: '',
    billing_poc_phone: ''
  })

  useEffect(() => {
    if (userOrganization) {
      console.log('OrganizationTab - updating form data with organization:', userOrganization.name)
      setOrgFormData({
        name: userOrganization.name || '',
        country: userOrganization.country || '',
        status: userOrganization.status || 'active',
        billing_poc_user_id: userOrganization.billing_poc_user_id || null,
        billing_poc_additional_email: userOrganization.billing_poc_additional_email || '',
        billing_poc_phone: userOrganization.billing_poc_phone || ''
      })
    }
  }, [userOrganization])

  const handleOrgSave = async () => {
    if (!userOrganization?.id) {
      console.error('OrganizationTab handleOrgSave - Cannot save: no organization ID')
      return
    }

    // Enhanced validation for both workspace owners and platform admins
    if ((userType === 'workspace_owner' || userType === 'platform_admin') && user && userOrganization.owner_id !== user.id) {
      console.error('OrganizationTab handleOrgSave - User trying to edit organization they do not own:', {
        userType,
        userId: user.id,
        organizationOwnerId: userOrganization.owner_id,
        organizationName: userOrganization.name
      })
      return
    }

    try {
      console.log('OrganizationTab handleOrgSave - saving organization:', userOrganization.id, 'data:', orgFormData)
      await updateOrganization(userOrganization.id, orgFormData)
    } catch (error) {
      console.error('OrganizationTab handleOrgSave - save error:', error)
      // Error handling is done in the hook
    }
  }

  // Show error state if there's an error
  if (error) {
    console.log('OrganizationTab - rendering error state:', error)
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <Building className="h-5 w-5" />
              Organization Settings
            </CardTitle>
            <CardDescription>
              Manage your organization details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-destructive">Error loading organization data: {error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    console.log('OrganizationTab - rendering loading state')
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <Building className="h-5 w-5" />
              Organization Settings
            </CardTitle>
            <CardDescription>
              Manage your organization details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading organization data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show no organization message
  if (!userOrganization) {
    console.log('OrganizationTab - rendering no organization state')
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <Building className="h-5 w-5" />
              Organization Settings
            </CardTitle>
            <CardDescription>
              Manage your organization details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {userType === 'workspace_owner' 
                  ? 'No organization found. Please contact support if you believe this is an error.'
                  : userType === 'platform_admin'
                  ? 'No organization data available. Please contact support if you believe this is an error.'
                  : 'No organization data available'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Enhanced ownership validation for both workspace owners and platform admins
  if ((userType === 'workspace_owner' || userType === 'platform_admin') && user && userOrganization.owner_id !== user.id) {
    console.log('OrganizationTab - user viewing non-owned organization:', {
      userType,
      userId: user.id,
      organizationOwnerId: userOrganization.owner_id,
      organizationName: userOrganization.name
    })
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <Building className="h-5 w-5" />
              Organization Settings
            </CardTitle>
            <CardDescription>
              Manage your organization details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                You can only view and edit organizations that you own. Please contact support if you need to be assigned as the owner of an organization.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Current organization: {userOrganization.name} (Owner: {userOrganization.owner_id})
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render the form only when we have valid organization data and proper ownership
  console.log('OrganizationTab - rendering form with organization:', userOrganization.name, 'owner validation passed')
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <Building className="h-5 w-5" />
            Organization Settings
          </CardTitle>
          <CardDescription>
            Manage your organization details and preferences including billing point of contact
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
    </div>
  )
}
