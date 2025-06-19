
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
}

export function OrganizationTab() {
  const { organizations, updateOrganization, isLoading, error } = useOrganizations()
  const { userType, user } = useAuth()
  
  console.log('OrganizationTab render - organizations:', organizations, 'isLoading:', isLoading, 'error:', error, 'userType:', userType)
  
  // Get the user's organization - prioritize owned organizations for workspace owners
  const getUserOrganization = () => {
    if (!organizations || organizations.length === 0) return null
    
    // For workspace owners, find the organization they own
    if (userType === 'workspace_owner' && user) {
      const ownedOrganization = organizations.find(org => org.owner_id === user.id)
      if (ownedOrganization) {
        console.log('Found owned organization for workspace owner:', ownedOrganization)
        return ownedOrganization
      }
      
      // Fallback to first organization if no owned organization found
      console.log('No owned organization found, using first available organization')
    }
    
    // For platform admins or fallback case, use first organization
    return organizations[0]
  }
  
  const userOrganization = getUserOrganization()
  console.log('OrganizationTab - selected userOrganization:', userOrganization)
  
  const [orgFormData, setOrgFormData] = useState<OrganizationFormData>({
    name: '',
    country: '',
    status: 'active'
  })

  useEffect(() => {
    if (userOrganization) {
      console.log('OrganizationTab - updating form data with:', userOrganization)
      setOrgFormData({
        name: userOrganization.name || '',
        country: userOrganization.country || '',
        status: userOrganization.status || 'active'
      })
    }
  }, [userOrganization])

  const handleOrgSave = async () => {
    if (!userOrganization?.id) {
      console.error('OrganizationTab - Cannot save: no organization ID')
      return
    }

    // Validation for workspace owners - ensure they can only edit organizations they own
    if (userType === 'workspace_owner' && user && userOrganization.owner_id !== user.id) {
      console.error('OrganizationTab - Workspace owner trying to edit organization they do not own')
      return
    }

    try {
      console.log('OrganizationTab - saving organization:', userOrganization.id, orgFormData)
      await updateOrganization(userOrganization.id, orgFormData)
    } catch (error) {
      console.error('OrganizationTab - save error:', error)
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
                  : 'No organization data available'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show ownership warning for workspace owners if they don't own the organization
  if (userType === 'workspace_owner' && user && userOrganization.owner_id !== user.id) {
    console.log('OrganizationTab - workspace owner viewing non-owned organization')
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
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render the form only when we have valid organization data and proper ownership
  console.log('OrganizationTab - rendering form with organization:', userOrganization)
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
