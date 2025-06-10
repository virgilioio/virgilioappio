
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
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
      <div className="text-center py-layout-md">
        <p className="text-muted-foreground">No organization found.</p>
        <p className="text-sm text-muted-foreground mt-sm">
          Contact your administrator to set up an organization.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-md">
      <div className="grid gap-md">
        <div>
          <Label htmlFor="org-name">Organization Name</Label>
          <Input
            id="org-name"
            value={formData.name}
            onChange={(e) => updateFormData('name', e.target.value)}
            placeholder="Enter organization name"
          />
        </div>

        <div>
          <Label htmlFor="org-country">Country</Label>
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
        </div>

        <div>
          <Label htmlFor="org-status">Status</Label>
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
        </div>
      </div>

      <div className="pt-md border-t">
        <div className="grid gap-sm text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Organization ID:</span>
            <code className="text-xs">{organization.id}</code>
          </div>
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{new Date(organization.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-md">
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
