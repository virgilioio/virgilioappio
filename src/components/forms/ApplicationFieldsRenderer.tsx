import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ApplicationFieldWithRelations } from '@/hooks/useApplicationFields'
import { PostingField } from '@/hooks/useJobPostingFields'

interface ApplicationFieldsRendererProps {
  fields: (ApplicationFieldWithRelations | PostingField)[]
  responses: Record<string, any>
  onResponseChange: (responses: Record<string, any>) => void
}

export function ApplicationFieldsRenderer({ 
  fields, 
  responses, 
  onResponseChange 
}: ApplicationFieldsRendererProps) {
  
  const handleFieldChange = (fieldName: string, value: any) => {
    onResponseChange({
      ...responses,
      [fieldName]: value
    })
  }

  const renderField = (field: ApplicationFieldWithRelations | PostingField) => {
    const fieldValue = responses[field.field_name] || ''

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <div key={field.field_name} className="space-y-2">
            <Label htmlFor={field.field_name}>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.field_name}
              type={field.field_type}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder_text || ''}
              required={field.is_required}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        )

      case 'number':
        return (
          <div key={field.field_name} className="space-y-2">
            <Label htmlFor={field.field_name}>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.field_name}
              type="number"
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder_text || ''}
              required={field.is_required}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.field_name} className="space-y-2">
            <Label htmlFor={field.field_name}>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={field.field_name}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder_text || ''}
              required={field.is_required}
              rows={4}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        )

      case 'select':
        const selectOptions = 'select_options' in field ? field.select_options : []
        return (
          <div key={field.field_name} className="space-y-2">
            <Label htmlFor={field.field_name}>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={fieldValue}
              onValueChange={(value) => handleFieldChange(field.field_name, value)}
              required={field.is_required}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder_text || 'Select an option'} />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.map((option) => (
                  <SelectItem key={option.id} value={option.option_value}>
                    {option.option_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        )

      case 'checkbox':
        return (
          <div key={field.field_name} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.field_name}
                checked={fieldValue === true}
                onCheckedChange={(checked) => handleFieldChange(field.field_name, checked)}
                required={field.is_required}
              />
              <Label htmlFor={field.field_name}>
                {field.field_label}
                {field.is_required && <span className="text-destructive ml-1">*</span>}
              </Label>
            </div>
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        )

      case 'date':
        return (
          <div key={field.field_name} className="space-y-2">
            <Label htmlFor={field.field_name}>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.field_name}
              type="date"
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
            />
            {field.help_text && (
              <p className="text-sm text-muted-foreground">{field.help_text}</p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {fields.map(renderField)}
    </div>
  )
}