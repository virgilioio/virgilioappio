
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent } from '@/components/ui/card'
import { Save, Loader2 } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { useCountries } from '@/hooks/useCountries'
import { useCountryFields } from '@/hooks/useCountryFields'
import { useOrganizationCustomData } from '@/hooks/useOrganizationCustomData'
import { CustomFieldInput } from '@/components/organizations/CustomFieldInput'
import { BillingPOCSection } from './BillingPOCSection'
import { useToast } from '@/hooks/use-toast'

interface OrganizationFormData {
  name: string
  country: string
  status: 'active' | 'inactive'
  billing_poc_user_id: string | null
  billing_poc_additional_email: string
  billing_poc_phone: string
}

interface Organization {
  id: string
  name: string
  country: string
  status: 'active' | 'inactive'
  created_at: string
  billing_poc_user_id?: string | null
  billing_poc_additional_email?: string | null
  billing_poc_phone?: string | null
  billing_poc_user_email?: string | null
  billing_poc_user_name?: string | null
}

interface OrganizationFormProps {
  organization: Organization | undefined
  formData: OrganizationFormData
  onFormDataChange: (data: OrganizationFormData) => void
  updateOrganization: (id: string, data: OrganizationFormData) => Promise<void>
  onSaveSuccess: () => void
  isLoading: boolean
}

export function OrganizationForm({ 
  organization, 
  formData, 
  onFormDataChange,
  updateOrganization,
  onSaveSuccess,
  isLoading 
}: OrganizationFormProps) {
  const permissions = usePermissions()
  const { countries } = useCountries()
  const { fields, isLoading: fieldsLoading } = useCountryFields(formData.country)
  const { 
    customData, 
    saveCustomData, 
    uploadFile, 
    deleteFile 
  } = useOrganizationCustomData(organization?.id)
  const { toast } = useToast()

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [customFieldFiles, setCustomFieldFiles] = useState<Record<string, File>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [billingPOCErrors, setBillingPOCErrors] = useState<Record<string, string>>({})

  console.log('OrganizationForm render - organization:', organization, 'formData:', formData)

  // Load existing custom data when component mounts or data changes
  useEffect(() => {
    if (customData.length > 0) {
      const values: Record<string, string> = {}
      customData.forEach(data => {
        if (data.field_value) {
          values[data.country_field_id] = data.field_value
        }
      })
      setCustomFieldValues(values)
    }
  }, [customData])

  const updateFormData = (field: keyof OrganizationFormData, value: string | null) => {
    onFormDataChange({ ...formData, [field]: value })
    
    // Clear billing POC errors when user makes changes
    if (field.startsWith('billing_poc_')) {
      setBillingPOCErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleBillingPOCChange = (data: Partial<Pick<OrganizationFormData, 'billing_poc_user_id' | 'billing_poc_additional_email' | 'billing_poc_phone'>>) => {
    const updatedFormData = { ...formData, ...data }
    onFormDataChange(updatedFormData)
    
    // Clear related errors
    Object.keys(data).forEach(key => {
      setBillingPOCErrors(prev => ({ ...prev, [key]: '' }))
    })
  }

  // Early return with safe fallback if no organization
  if (!organization) {
    console.log('OrganizationForm - no organization provided')
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No organization found.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Contact your administrator to set up an organization.
          </p>
        </CardContent>
      </Card>
    )
  }

  const validateBillingPOC = (): boolean => {
    const errors: Record<string, string> = {}
    let hasErrors = false

    // Only validate if user is platform admin or workspace owner
    if (permissions.isPlatformAdmin || permissions.canManageOrganization) {
      if (!formData.billing_poc_user_id) {
        errors.billing_poc_user_id = 'Billing POC user is required for compliance'
        hasErrors = true
      }

      if (!formData.billing_poc_phone || formData.billing_poc_phone.trim() === '') {
        errors.billing_poc_phone = 'Phone number is required for billing POC'
        hasErrors = true
      }

      // Validate additional email format if provided
      if (formData.billing_poc_additional_email && formData.billing_poc_additional_email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData.billing_poc_additional_email)) {
          errors.billing_poc_additional_email = 'Invalid email format'
          hasErrors = true
        }
      }
    }

    setBillingPOCErrors(errors)
    return !hasErrors
  }

  const validateCustomField = (field: any, value: string): string | null => {
    if (field.is_required && (!value || value.trim() === '')) {
      return `${field.field_label} is required`
    }

    if (!field.validation_rules || !value) return null

    for (const rule of field.validation_rules) {
      switch (rule.rule_type) {
        case 'regex':
          if (!new RegExp(rule.rule_value).test(value)) {
            return rule.error_message
          }
          break
        case 'min_length':
          if (value.length < parseInt(rule.rule_value)) {
            return rule.error_message
          }
          break
        case 'max_length':
          if (value.length > parseInt(rule.rule_value)) {
            return rule.error_message
          }
          break
        case 'min_value':
          if (parseFloat(value) < parseFloat(rule.rule_value)) {
            return rule.error_message
          }
          break
        case 'max_value':
          if (parseFloat(value) > parseFloat(rule.rule_value)) {
            return rule.error_message
          }
          break
      }
    }
    return null
  }

  const validateAllCustomFields = (): boolean => {
    const errors: Record<string, string> = {}
    let hasErrors = false

    fields.forEach(field => {
      const value = customFieldValues[field.id] || ''
      const fileData = customData.find(data => data.country_field_id === field.id)
      
      // For file fields, check if file exists or if field is required
      if (field.field_type === 'file') {
        if (field.is_required && !fileData?.file_url && !customFieldFiles[field.id]) {
          errors[field.id] = `${field.field_label} is required`
          hasErrors = true
        }
      } else {
        const error = validateCustomField(field, value)
        if (error) {
          errors[field.id] = error
          hasErrors = true
        }
      }
    })

    setFieldErrors(errors)
    return !hasErrors
  }

  const handleCustomFieldValueChange = (fieldId: string, value: string) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))
    
    // Clear error when user starts typing
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => ({ ...prev, [fieldId]: '' }))
    }
  }

  const handleCustomFieldFileChange = (fieldId: string, file: File | null) => {
    if (file) {
      setCustomFieldFiles(prev => ({ ...prev, [fieldId]: file }))
    } else {
      setCustomFieldFiles(prev => {
        const updated = { ...prev }
        delete updated[fieldId]
        return updated
      })
      
      // Also clear any existing file data
      const existingData = customData.find(data => data.country_field_id === fieldId)
      if (existingData?.file_url) {
        deleteFile(existingData.file_url)
      }
    }

    // Clear error when user selects file
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => ({ ...prev, [fieldId]: '' }))
    }
  }

  const handleSave = async () => {
    if (!organization?.id) {
      toast({
        title: "Error",
        description: "Cannot save: organization not found",
        variant: "destructive"
      })
      return
    }

    // Show immediate feedback that save was triggered
    setIsSaving(true)

    try {
      // Validate billing POC and custom fields
      const isBillingPOCValid = validateBillingPOC()
      const areCustomFieldsValid = validateAllCustomFields()
      
      if (!isBillingPOCValid || !areCustomFieldsValid) {
        toast({
          title: "Validation Error",
          description: "Please fix the validation errors before saving",
          variant: "destructive"
        })
        setIsSaving(false)
        return
      }

      // Save basic organization data first
      console.log('OrganizationForm handleSave - saving organization:', organization.id, 'data:', formData)
      await updateOrganization(organization.id, formData)

      // Save custom field data
      for (const field of fields) {
        const value = customFieldValues[field.id]
        const file = customFieldFiles[field.id]

        if (field.field_type === 'file' && file) {
          // Upload file and save data
          const fileData = await uploadFile(file, organization.id, field.field_name)
          await saveCustomData(organization.id, field.id, undefined, fileData)
        } else if (field.field_type !== 'file' && value !== undefined) {
          // Save text/other field data
          await saveCustomData(organization.id, field.id, value)
        }
      }

      // Clear file uploads after successful save
      setCustomFieldFiles({})

      // Show success message
      toast({
        title: "Success",
        description: "Organization settings saved successfully",
      })

      // Notify parent of successful save
      onSaveSuccess()

    } catch (error) {
      console.error('Error saving organization data:', error)
      toast({
        title: "Save Failed",
        description: "There was an error saving your changes. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getCustomFieldValue = (fieldId: string) => {
    return customFieldValues[fieldId] || ''
  }

  const getCustomFieldFileData = (fieldId: string) => {
    const data = customData.find(data => data.country_field_id === fieldId)
    if (data?.file_url) {
      return {
        url: data.file_url,
        name: data.file_name || 'File',
        size: data.file_size_bytes || 0
      }
    }
    return undefined
  }

  const canManageBillingPOC = permissions.isPlatformAdmin || permissions.canManageOrganization
  const isReadOnly = !canManageBillingPOC

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardContent className="p-6">
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
                    <SelectItem key={country.id} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {permissions.isPlatformAdmin && (
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
            )}

            {!permissions.isPlatformAdmin && (
              <FormField label="Status" htmlFor="org-status-readonly">
                <div className="px-3 py-2 bg-muted rounded-md text-sm">
                  <span className="capitalize">{formData.status}</span>
                  <span className="text-muted-foreground ml-2">
                    (Only platform administrators can change status)
                  </span>
                </div>
              </FormField>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing POC Section */}
      {canManageBillingPOC && (
        <BillingPOCSection
          organizationId={organization.id}
          data={{
            billing_poc_user_id: formData.billing_poc_user_id,
            billing_poc_additional_email: formData.billing_poc_additional_email,
            billing_poc_phone: formData.billing_poc_phone
          }}
          onChange={handleBillingPOCChange}
          isReadOnly={isReadOnly}
          errors={billingPOCErrors}
        />
      )}

      {/* Country-specific fields */}
      {formData.country && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">
              Country-Specific Information
            </h3>
            
            {fieldsLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : fields.length > 0 ? (
              <div className="grid gap-4">
                {fields.map(field => (
                  <CustomFieldInput
                    key={field.id}
                    field={field}
                    value={getCustomFieldValue(field.id)}
                    fileData={getCustomFieldFileData(field.id)}
                    onValueChange={(value) => handleCustomFieldValueChange(field.id, value)}
                    onFileChange={(file) => handleCustomFieldFileChange(field.id, file)}
                    error={fieldErrors[field.id]}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No additional fields required for this country.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Organization ID:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">{organization.id}</code>
            </div>
            <div className="flex justify-between">
              <span>Created:</span>
              <span>{new Date(organization.created_at).toLocaleDateString()}</span>
            </div>
            {organization.billing_poc_user_name && (
              <div className="flex justify-between">
                <span>Current Billing POC:</span>
                <span>{organization.billing_poc_user_name} ({organization.billing_poc_user_email})</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
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
    </div>
  )
}
