import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'
import { useCountryFields } from '@/hooks/useCountryFields'
import { CountryField } from '@/hooks/useCountries'

interface CountryFieldFormProps {
  isOpen: boolean
  onClose: () => void
  countryId: string
  countryCode: string
  field?: CountryField | null
  onFieldChange?: () => void
}

interface SelectOption {
  value: string
  label: string
}

interface ValidationRule {
  type: string
  value: string
  message: string
}

type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'url'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'File Upload' }
]

const FILE_TYPES = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/jpeg', label: 'JPEG Image' },
  { value: 'image/png', label: 'PNG Image' },
  { value: 'image/gif', label: 'GIF Image' },
  { value: 'application/msword', label: 'Word Document' },
  { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word Document (DOCX)' },
  { value: 'text/plain', label: 'Text File' }
]

export function CountryFieldForm({ isOpen, onClose, countryId, countryCode, field, onFieldChange }: CountryFieldFormProps) {
  const { createField, updateField, fields } = useCountryFields(countryCode)
  const [isLoading, setIsLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text' as FieldType,
    is_required: false,
    display_order: 1,
    placeholder_text: '',
    help_text: '',
    accepted_file_types: [] as string[],
    max_file_size_mb: 5
  })
  
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([])
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([])

  useEffect(() => {
    if (field) {
      setFormData({
        field_name: field.field_name,
        field_label: field.field_label,
        field_type: field.field_type,
        is_required: field.is_required,
        display_order: field.display_order,
        placeholder_text: field.placeholder_text || '',
        help_text: field.help_text || '',
        accepted_file_types: field.accepted_file_types ? JSON.parse(field.accepted_file_types) : [],
        max_file_size_mb: field.max_file_size_mb || 5
      })

      // Load existing select options for this field
      const existingField = fields.find(f => f.id === field.id)
      if (existingField && existingField.select_options) {
        const options = existingField.select_options.map(option => ({
          value: option.option_value,
          label: option.option_label
        }))
        console.log('Loading existing select options:', options)
        setSelectOptions(options)
      }
    } else {
      setFormData({
        field_name: '',
        field_label: '',
        field_type: 'text',
        is_required: false,
        display_order: 1,
        placeholder_text: '',
        help_text: '',
        accepted_file_types: [],
        max_file_size_mb: 5
      })
      setSelectOptions([])
      setValidationRules([])
    }
  }, [field, isOpen, fields])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate select fields have at least one option
    if (formData.field_type === 'select' && selectOptions.length === 0) {
      alert('Select fields must have at least one option')
      return
    }

    // Validate that select options have both value and label
    if (formData.field_type === 'select') {
      const invalidOptions = selectOptions.some(option => !option.value.trim() || !option.label.trim())
      if (invalidOptions) {
        alert('All select options must have both a value and a label')
        return
      }
    }

    setIsLoading(true)

    try {
      const fieldData = {
        country_id: countryId,
        field_name: formData.field_name,
        field_label: formData.field_label,
        field_type: formData.field_type,
        is_required: formData.is_required,
        display_order: formData.display_order,
        placeholder_text: formData.placeholder_text || null,
        help_text: formData.help_text || null,
        accepted_file_types: formData.field_type === 'file' && formData.accepted_file_types.length > 0 
          ? JSON.stringify(formData.accepted_file_types) 
          : null,
        max_file_size_mb: formData.field_type === 'file' ? formData.max_file_size_mb : null
      }

      console.log('Submitting field data:', fieldData)
      console.log('Select options to save:', selectOptions)

      if (field) {
        await updateField(field.id, fieldData, formData.field_type === 'select' ? selectOptions : undefined)
      } else {
        await createField(fieldData, formData.field_type === 'select' ? selectOptions : undefined)
      }
      
      // Call the callback to refresh the parent component
      if (onFieldChange) {
        await onFieldChange()
      }
      
      onClose()
    } catch (error) {
      console.error('Error saving field:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateFormData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const addSelectOption = () => {
    setSelectOptions(prev => [...prev, { value: '', label: '' }])
  }

  const updateSelectOption = (index: number, key: 'value' | 'label', value: string) => {
    setSelectOptions(prev => prev.map((option, i) => 
      i === index ? { ...option, [key]: value } : option
    ))
  }

  const removeSelectOption = (index: number) => {
    setSelectOptions(prev => prev.filter((_, i) => i !== index))
  }

  const toggleFileType = (fileType: string) => {
    setFormData(prev => ({
      ...prev,
      accepted_file_types: prev.accepted_file_types.includes(fileType)
        ? prev.accepted_file_types.filter(type => type !== fileType)
        : [...prev.accepted_file_types, fileType]
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {field ? 'Edit Field' : 'Add Field'} for {countryCode}
          </DialogTitle>
          <DialogDescription>
            {field ? 'Update field configuration' : 'Define a new custom field for organizations in this country'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Field Name" required htmlFor="field_name">
              <Input
                id="field_name"
                value={formData.field_name}
                onChange={(e) => updateFormData('field_name', e.target.value)}
                placeholder="e.g., rfc, ein, tax_id"
                required
              />
            </FormField>

            <FormField label="Display Label" required htmlFor="field_label">
              <Input
                id="field_label"
                value={formData.field_label}
                onChange={(e) => updateFormData('field_label', e.target.value)}
                placeholder="e.g., RFC Number, EIN"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Field Type" required htmlFor="field_type">
              <Select 
                value={formData.field_type} 
                onValueChange={(value: FieldType) => updateFormData('field_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Display Order" htmlFor="display_order">
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => updateFormData('display_order', parseInt(e.target.value))}
                min="1"
              />
            </FormField>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_required"
              checked={formData.is_required}
              onCheckedChange={(checked) => updateFormData('is_required', checked)}
            />
            <label htmlFor="is_required" className="text-sm font-medium">
              Required field
            </label>
          </div>

          <FormField label="Placeholder Text" htmlFor="placeholder_text">
            <Input
              id="placeholder_text"
              value={formData.placeholder_text}
              onChange={(e) => updateFormData('placeholder_text', e.target.value)}
              placeholder="Placeholder text shown in the input"
            />
          </FormField>

          <FormField label="Help Text" htmlFor="help_text">
            <Textarea
              id="help_text"
              value={formData.help_text}
              onChange={(e) => updateFormData('help_text', e.target.value)}
              placeholder="Additional help text to guide users"
              rows={2}
            />
          </FormField>

          {formData.field_type === 'file' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">File Upload Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Maximum File Size (MB)" htmlFor="max_file_size">
                  <Input
                    id="max_file_size"
                    type="number"
                    value={formData.max_file_size_mb}
                    onChange={(e) => updateFormData('max_file_size_mb', parseInt(e.target.value))}
                    min="1"
                    max="50"
                  />
                </FormField>

                <FormField label="Accepted File Types">
                  <div className="grid grid-cols-2 gap-2">
                    {FILE_TYPES.map(fileType => (
                      <div key={fileType.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={fileType.value}
                          checked={formData.accepted_file_types.includes(fileType.value)}
                          onCheckedChange={() => toggleFileType(fileType.value)}
                        />
                        <label htmlFor={fileType.value} className="text-sm">
                          {fileType.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {formData.accepted_file_types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.accepted_file_types.map(type => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {FILE_TYPES.find(ft => ft.value === type)?.label || type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </FormField>
              </CardContent>
            </Card>
          )}

          {formData.field_type === 'select' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  Select Options
                  <Button type="button" variant="outline" size="sm" onClick={addSelectOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectOptions.map((option, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <FormField label="Value" className="flex-1">
                      <Input
                        value={option.value}
                        onChange={(e) => updateSelectOption(index, 'value', e.target.value)}
                        placeholder="option_value"
                        required
                      />
                    </FormField>
                    <FormField label="Label" className="flex-1">
                      <Input
                        value={option.label}
                        onChange={(e) => updateSelectOption(index, 'label', e.target.value)}
                        placeholder="Display Label"
                        required
                      />
                    </FormField>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSelectOption(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {selectOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No options added yet. Click "Add Option" to create select options.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : field ? 'Update Field' : 'Create Field'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}