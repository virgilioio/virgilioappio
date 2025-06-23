
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Organization } from '@/hooks/useOrganizations'
import { useCountries } from '@/hooks/useCountries'
import { useBillingPOCMembers } from '@/hooks/useBillingPOCMembers'
import { Save, Loader2 } from 'lucide-react'

interface OrganizationFormData {
  name: string
  country: string
  status: 'active' | 'inactive'
  billing_poc_user_id: string | null
  billing_poc_additional_email: string
  billing_poc_phone: string
}

interface OrganizationFormProps {
  organization: Organization
  formData: OrganizationFormData
  onFormDataChange: (data: OrganizationFormData) => void
  updateOrganization: (id: string, data: OrganizationFormData) => Promise<void>
  onSaveSuccess?: () => void
  isLoading?: boolean
  hideActionButtons?: boolean
}

export function OrganizationForm({
  organization,
  formData,
  onFormDataChange,
  updateOrganization,
  onSaveSuccess,
  isLoading = false,
  hideActionButtons = false
}: OrganizationFormProps) {
  const { countries } = useCountries()
  const { members: billingPOCMembers, isLoading: membersLoading } = useBillingPOCMembers(organization.id)
  const [isSaving, setIsSaving] = useState(false)

  // Create options for countries dropdown
  const countryOptions = countries.map(country => ({
    value: country.code,
    label: country.name
  }))

  // Create options for billing POC dropdown from organization members
  const billingPOCOptions = billingPOCMembers.map(member => ({
    value: member.user_id || '',
    label: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email || 'Unknown User'
  }))

  const handleInputChange = (field: keyof OrganizationFormData, value: string | null) => {
    const updatedData = {
      ...formData,
      [field]: value
    }
    onFormDataChange(updatedData)
  }

  const handleSave = async () => {
    if (!organization?.id) return

    setIsSaving(true)
    try {
      await updateOrganization(organization.id, formData)
      onSaveSuccess?.()
    } catch (error) {
      console.error('Error saving organization:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Organization Name */}
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter organization name"
            />
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <SearchableSelect
              options={countryOptions}
              value={formData.country}
              onValueChange={(value) => handleInputChange('country', value)}
              placeholder="Select country"
              searchPlaceholder="Search countries..."
              emptyMessage="No countries found."
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: 'active' | 'inactive') => handleInputChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Billing POC */}
          <div className="space-y-2">
            <Label htmlFor="billing-poc">Billing Point of Contact</Label>
            {membersLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading organization members...</span>
              </div>
            ) : (
              <SearchableSelect
                options={billingPOCOptions}
                value={formData.billing_poc_user_id || ''}
                onValueChange={(value) => handleInputChange('billing_poc_user_id', value || null)}
                placeholder="Select billing POC"
                searchPlaceholder="Search members..."
                emptyMessage="No organization members found."
              />
            )}
          </div>

          {/* Additional Email */}
          <div className="space-y-2">
            <Label htmlFor="additional-email">Additional Billing Email</Label>
            <Input
              id="additional-email"
              type="email"
              value={formData.billing_poc_additional_email}
              onChange={(e) => handleInputChange('billing_poc_additional_email', e.target.value)}
              placeholder="Enter additional billing email"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Billing Contact Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.billing_poc_phone}
              onChange={(e) => handleInputChange('billing_poc_phone', e.target.value)}
              placeholder="Enter billing contact phone"
            />
          </div>
        </div>

        {!hideActionButtons && (
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSave}
              disabled={isLoading || isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
