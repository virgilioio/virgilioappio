
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Save } from 'lucide-react'

interface OrganizationFormData {
  name: string
  country: string
  status: 'active' | 'inactive'
}

interface Organization {
  id: string
  name: string
  country: string
  status: 'active' | 'inactive'
  created_at: string
}

interface OrganizationFormProps {
  organization: Organization | undefined
  formData: OrganizationFormData
  onFormDataChange: (data: OrganizationFormData) => void
  onSave: () => void
  isLoading: boolean
}

export function OrganizationForm({ 
  organization, 
  formData, 
  onFormDataChange, 
  onSave, 
  isLoading 
}: OrganizationFormProps) {
  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 
    'Italy', 'Spain', 'Netherlands', 'Australia', 'Japan', 'Other'
  ]

  const updateFormData = (field: keyof OrganizationFormData, value: string) => {
    onFormDataChange({ ...formData, [field]: value })
  }

  if (!organization) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No organization found.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Contact your administrator to set up an organization.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="grid gap-4">
        <FormField label="Organization Name" required htmlFor="org-name">
          <Input
            id="org-name"
            value={formData.name}
            onChange={(e) => updateFormData('name', e.target.value)}
            placeholder="Enter organization name"
          />
        </FormField>

        <FormField label="Country" required htmlFor="org-country">
          <Select 
            value={formData.country} 
            onValueChange={(value) => updateFormData('country', value)}
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
        </FormField>

        <FormField label="Status" htmlFor="org-status">
          <Select 
            value={formData.status} 
            onValueChange={(value) => updateFormData('status', value as 'active' | 'inactive')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="pt-4 border-t">
        <div className="grid gap-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Organization ID:</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">{organization.id}</code>
          </div>
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{new Date(organization.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          onClick={onSave} 
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
