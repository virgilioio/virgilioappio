
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent } from '@/components/ui/card'
import { usePermissions } from '@/hooks/usePermissions'
import { useCountries } from '@/hooks/useCountries'
import { useCountryFields } from '@/hooks/useCountryFields'
import { useOrganizationCustomData } from '@/hooks/useOrganizationCustomData'
import { CustomFieldInput } from '@/components/organizations/CustomFieldInput'
import { BillingPOCSection } from './BillingPOCSection'
import { useToast } from '@/hooks/use-toast'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useOrganizations } from '@/hooks/useOrganizations'

interface OrganizationFormData {
  name: string
  country: string
  status: 'active' | 'inactive'
  billing_poc_user_id: string | null
  billing_poc_additional_email: string
  billing_poc_phone: string
  parent_organization_id: string | null
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
  parent_organization_id?: string | null
}

interface OrganizationFormProps {
  organization: Organization | undefined
  formData: OrganizationFormData
  onFormDataChange: (data: OrganizationFormData) => void
  updateOrganization: (id: string, data: OrganizationFormData) => Promise<void>
  onSaveSuccess: () => void
  isLoading: boolean
  hideActionButtons?: boolean
}

export function OrganizationForm({ 
  organization, 
  formData, 
  onFormDataChange,
  updateOrganization,
  onSaveSuccess,
  isLoading,
  hideActionButtons = false
}: OrganizationFormProps) {
  const permissions = usePermissions()
  const { countries } = useCountries()
  const { fields, isLoading: fieldsLoading } = useCountryFields(formData.country)
  const { 
    customData, 
    saveCustomData, 
    uploadFile, 
    deleteFile,
    isLoading: customDataLoading 
  } = useOrganizationCustomData(organization?.id)
  const { toast } = useToast()
  const { organizations: allOrganizations } = useOrganizations()
  const parentOptions = [
    { value: 'none', label: 'No parent (top-level)' },
    ...allOrganizations
      .filter(o => o.id !== organization?.id)
      .map(o => ({ value: o.id, label: o.name }))
  ]

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [customFieldFiles, setCustomFieldFiles] = useState<Record<string, File>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [billingPOCErrors, setBillingPOCErrors] = useState<Record<string, string>>({})
  const [isSavingCustomData, setIsSavingCustomData] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  console.log('🔍 OrganizationForm DEBUG - Current state:', {
    organizationId: organization?.id,
    organizationCountry: formData.country,
    fieldsCount: fields.length,
    customDataCount: customData.length,
    customFieldValues,
    customFieldFiles: Object.keys(customFieldFiles),
    fieldsLoading,
    customDataLoading,
    hasUnsavedChanges
  })

  // Initialize custom field values from existing data
  useEffect(() => {
    console.log('🔄 useEffect triggered - customData changed:', customData)
    if (customData.length > 0) {
      const values: Record<string, string> = {}
      customData.forEach(data => {
        if (data.field_value) {
          values[data.country_field_id] = data.field_value
          console.log(`📝 Setting field value: ${data.country_field_id} = ${data.field_value}`)
        }
      })
      console.log('✅ Setting custom field values:', values)
      setCustomFieldValues(values)
    } else {
      console.log('❌ No custom data found, clearing values')
      setCustomFieldValues({})
    }
    setHasUnsavedChanges(false)
  }, [customData])

  // Reset custom field values when country changes
  useEffect(() => {
    console.log('🔄 Country changed, resetting custom field values. New country:', formData.country)
    setCustomFieldValues({})
    setCustomFieldFiles({})
    setFieldErrors({})
    setHasUnsavedChanges(false)
  }, [formData.country])

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
    console.log('❌ OrganizationForm - no organization provided')
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

  const saveAllCustomFieldData = async (): Promise<boolean> => {
    if (!organization) return false
    
    try {
      setIsSavingCustomData(true)
      console.log('Starting to save custom field data for fields:', fields)
      console.log('Current custom field values:', customFieldValues)
      console.log('Current custom field files:', customFieldFiles)
      
      // Save each field's data
      for (const field of fields) {
        const value = customFieldValues[field.id] || ''
        const file = customFieldFiles[field.id]
        
        console.log(`Processing field ${field.field_name} (${field.id}):`, { value, hasFile: !!file, fieldType: field.field_type })
        
        if (field.field_type === 'file') {
          if (file) {
            console.log('Uploading file for field:', field.field_name)
            // Upload file first
            const fileData = await uploadFile(file, organization.id, field.field_name)
            await saveCustomData(organization.id, field.id, undefined, fileData)
          }
          // For file fields, we don't save empty values
        } else {
          // For non-file fields, save the value (even if empty to clear previous values)
          console.log('Saving text value for field:', field.field_name, 'value:', value)
          await saveCustomData(organization.id, field.id, value || '')
        }
      }
      
      console.log('Finished saving all custom field data')
      setHasUnsavedChanges(false)
      toast({
        title: 'Success',
        description: 'Compliance information saved successfully',
      })
      return true
    } catch (error) {
      console.error('Error saving custom field data:', error)
      toast({
        title: 'Error',
        description: 'Failed to save compliance information',
        variant: 'destructive'
      })
      return false
    } finally {
      setIsSavingCustomData(false)
    }
  }

  const handleSave = async () => {
    if (!organization) return
    
    console.log('Starting save process...')
    
    // Validate all fields
    const billingPOCValid = validateBillingPOC()
    const customFieldsValid = validateAllCustomFields()
    
    if (!billingPOCValid || !customFieldsValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
        variant: 'destructive'
      })
      return
    }
    
    try {
      // Save organization data first
      console.log('Saving organization data...')
      await updateOrganization(organization.id, formData)
      
      // Save custom field data
      console.log('Saving custom field data...')
      const customDataSaved = await saveAllCustomFieldData()
      
      if (customDataSaved) {
        onSaveSuccess()
        toast({
          title: 'Success',
          description: 'Organization information saved successfully',
        })
      }
    } catch (error) {
      console.error('Error saving organization:', error)
      toast({
        title: 'Error',
        description: 'Failed to save organization information',
        variant: 'destructive'
      })
    }
  }

  const handleCustomFieldValueChange = (fieldId: string, value: string) => {
    console.log('📝 Custom field value changing:', { fieldId, value, organizationId: organization?.id })
    
    setCustomFieldValues(prev => {
      const updated = { ...prev, [fieldId]: value }
      console.log('📝 Updated customFieldValues:', updated)
      return updated
    })
    
    // Clear error when user starts typing
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => ({ ...prev, [fieldId]: '' }))
    }

    // Mark as having unsaved changes
    setHasUnsavedChanges(true)
  }

  const handleCustomFieldFileChange = (fieldId: string, file: File | null) => {
    console.log('📁 Custom field file changing:', { fieldId, fileName: file?.name, organizationId: organization?.id })
    
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

    // Mark as having unsaved changes
    setHasUnsavedChanges(true)
  }

  const getCustomFieldValue = (fieldId: string) => {
    const value = customFieldValues[fieldId] || ''
    console.log('🔍 Getting custom field value for:', fieldId, 'value:', value)
    return value
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
            <FormField label="Parent Organization" htmlFor="org-parent">
              <SearchableSelect
                options={parentOptions}
                value={formData.parent_organization_id || 'none'}
                onValueChange={(value) => updateFormData('parent_organization_id', value === 'none' ? null : value)}
                placeholder="Select a parent (optional)"
                searchPlaceholder="Search organizations..."
                emptyMessage="No organizations found."
              />
            </FormField>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                Country-Specific Compliance Information
              </h3>
              {hasUnsavedChanges && (
                <div className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded">
                  You have unsaved changes
                </div>
              )}
            </div>
            
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
                <div className="text-sm text-muted-foreground mb-2">
                  Fill out the compliance information and click "Save Compliance Data" to save your changes.
                </div>
                {fields.map(field => {
                  console.log('🎨 Rendering field:', field.field_name, 'with value:', getCustomFieldValue(field.id))
                  return (
                    <CustomFieldInput
                      key={field.id}
                      field={field}
                      value={getCustomFieldValue(field.id)}
                      fileData={getCustomFieldFileData(field.id)}
                      onValueChange={(value) => handleCustomFieldValueChange(field.id, value)}
                      onFileChange={(file) => handleCustomFieldFileChange(field.id, file)}
                      error={fieldErrors[field.id]}
                    />
                  )
                })}
                
                {/* Save Compliance Data Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    onClick={saveAllCustomFieldData}
                    disabled={isSavingCustomData || !hasUnsavedChanges}
                    className="min-w-[160px]"
                  >
                    {isSavingCustomData ? 'Saving...' : 'Save Compliance Data'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No additional compliance fields required for this country.
              </p>
            )}
            
            {customDataLoading && (
              <div className="text-sm text-muted-foreground mt-2">
                Loading compliance data...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save button for the organization form */}
      {!hideActionButtons && canManageBillingPOC && (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-end">
              <Button 
                onClick={async () => {
                  console.log('💾 Manual save triggered')
                  if (!organization) return
                  
                  try {
                    // Save organization data
                    await updateOrganization(organization.id, formData)
                    onSaveSuccess()
                    toast({
                      title: 'Success',
                      description: 'Organization information saved successfully',
                    })
                  } catch (error) {
                    console.error('❌ Error saving organization:', error)
                    toast({
                      title: 'Error',
                      description: 'Failed to save organization information',
                      variant: 'destructive'
                    })
                  }
                }}
                disabled={isLoading}
                className="min-w-[120px]"
              >
                {isLoading ? 'Saving...' : 'Save Organization'}
              </Button>
            </div>
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
            {customData.length > 0 && (
              <div className="mt-4">
                <span className="font-medium">Stored Compliance Data:</span>
                {customData.map(data => (
                  <div key={data.id} className="flex justify-between text-xs mt-1">
                    <span>Field {data.country_field_id}:</span>
                    <span>{data.field_value || data.file_name || 'No data'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
