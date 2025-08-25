import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { ApplicationFieldWithRelations } from '@/hooks/useApplicationFields'
import { PostingField } from '@/hooks/useJobPostingFields'
import { Control } from 'react-hook-form'

interface ApplicationFieldsRendererProps {
  fields: (ApplicationFieldWithRelations | PostingField)[]
  control: Control<any>
}

export function ApplicationFieldsRenderer({ 
  fields, 
  control 
}: ApplicationFieldsRendererProps) {
  
  const renderField = (field: ApplicationFieldWithRelations | PostingField) => {
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <FormField
            key={field.field_name}
            control={control}
            name={field.field_name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type={field.field_type}
                    placeholder={field.placeholder_text || ''}
                    {...formField}
                  />
                </FormControl>
                {field.help_text && (
                  <FormDescription>{field.help_text}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case 'number':
        return (
          <FormField
            key={field.field_name}
            control={control}
            name={field.field_name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={field.placeholder_text || ''}
                    {...formField}
                  />
                </FormControl>
                {field.help_text && (
                  <FormDescription>{field.help_text}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case 'textarea':
        return (
          <FormField
            key={field.field_name}
            control={control}
            name={field.field_name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={field.placeholder_text || ''}
                    rows={4}
                    {...formField}
                  />
                </FormControl>
                {field.help_text && (
                  <FormDescription>{field.help_text}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case 'select':
        const selectOptions = 'select_options' in field ? field.select_options : []
        return (
          <FormField
            key={field.field_name}
            control={control}
            name={field.field_name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <Select onValueChange={formField.onChange} value={formField.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder_text || 'Select an option'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectOptions.map((option) => (
                      <SelectItem key={option.id} value={option.option_value}>
                        {option.option_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.help_text && (
                  <FormDescription>{field.help_text}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case 'checkbox':
        return (
          <FormField
            key={field.field_name}
            control={control}
            name={field.field_name}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={formField.value}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    {field.field_label}
                    {field.is_required && <span className="text-destructive ml-1">*</span>}
                  </FormLabel>
                  {field.help_text && (
                    <FormDescription>{field.help_text}</FormDescription>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case 'date':
        return (
          <FormField
            key={field.field_name}
            control={control}
            name={field.field_name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...formField}
                  />
                </FormControl>
                {field.help_text && (
                  <FormDescription>{field.help_text}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
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