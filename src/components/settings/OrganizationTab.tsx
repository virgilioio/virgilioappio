
import { useState, useEffect } from 'react'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building } from 'lucide-react'
import { OrganizationForm } from './OrganizationForm'

interface OrganizationFormData {
  name: string
  country: string
  status: 'active' | 'inactive'
}

export function OrganizationTab() {
  const { organizations, updateOrganization, isLoading, error } = useOrganizations()
  
  // Get the user's organization - workspace owners should have one
  const userOrganization = organizations?.[0]
  
  const [orgFormData, setOrgFormData] = useState<OrganizationFormData>({
    name: '',
    country: '',
    status: 'active'
  })

  useEffect(() => {
    if (userOrganization) {
      setOrgFormData({
        name: userOrganization.name || '',
        country: userOrganization.country || '',
        status: userOrganization.status || 'active'
      })
    }
  }, [userOrganization])

  const handleOrgSave = async () => {
    if (!userOrganization?.id) {
      return
    }

    try {
      await updateOrganization(userOrganization.id, orgFormData)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  // Show error state if there's an error
  if (error) {
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
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading organization data...</p>
            </div>
          ) : !userOrganization ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No organization data available</p>
            </div>
          ) : (
            <OrganizationForm
              organization={userOrganization}
              formData={orgFormData}
              onFormDataChange={setOrgFormData}
              onSave={handleOrgSave}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
