
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
  const { organizations, updateOrganization, isLoading } = useOrganizations()
  
  // Get the first organization for demo purposes - in a real app this would be based on user's organization
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
        status: userOrganization.status as 'active' | 'inactive' || 'active'
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
