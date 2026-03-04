import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { ApplicationFieldWithRelations } from '@/hooks/useApplicationFields'
import { PostingField, SalaryFieldConfig, LocationFieldConfig } from '@/hooks/useJobPostingFields'
import { Control } from 'react-hook-form'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { MapPin } from 'lucide-react'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'

function getAutoPlaceholder(field: { field_label: string; field_type: string; placeholder_text?: string | null }): string {
  if (field.placeholder_text) return field.placeholder_text
  const label = field.field_label
  switch (field.field_type) {
    case 'select':
    case 'checkbox_group':
      return `Select ${label}`
    case 'file':
      return `Upload ${label}`
    default:
      return `Enter your ${label}`
  }
}

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
                    placeholder={getAutoPlaceholder(field)}
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
                    placeholder={getAutoPlaceholder(field)}
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
                    placeholder={getAutoPlaceholder(field)}
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
                      <SelectValue placeholder={getAutoPlaceholder(field)} />
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

      case 'checkbox_group':
        const groupOptions: any[] = 'select_options' in field ? (field as any).select_options || [] : []
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
                <div className="space-y-2">
                  {groupOptions.map((option) => {
                    const values: string[] = formField.value || []
                    return (
                      <div key={option.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={values.includes(option.option_value)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...values, option.option_value]
                              : values.filter((v: string) => v !== option.option_value)
                            formField.onChange(next)
                          }}
                        />
                        <span className="text-sm">{option.option_label}</span>
                      </div>
                    )
                  })}
                </div>
                {field.help_text && (
                  <FormDescription>{field.help_text}</FormDescription>
                )}
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
                  <DatePickerVirgilio
                    value={formField.value ? new Date(formField.value) : undefined}
                    onChange={(date) => formField.onChange(date.toISOString().split('T')[0])}
                    placeholder="Pick a date"
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

      case 'salary':
        const salaryConfig = ('field_config' in field ? field.field_config : null) as SalaryFieldConfig | null
        const currency = salaryConfig?.currency || 'USD'
        const period = salaryConfig?.period || 'annually'
        const symbol = CURRENCY_SYMBOLS[currency] || currency
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0">{symbol}</Badge>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder={`Enter amount`}
                      {...formField}
                    />
                  </FormControl>
                  <Badge variant="secondary" className="shrink-0 capitalize">{period}</Badge>
                </div>
                <FormDescription className="text-green-600">
                  This will be added to your candidate profile.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case 'location':
        const locationConfig = ('field_config' in field ? field.field_config : null) as LocationFieldConfig | null
        const locationFields = locationConfig?.fields || ['city', 'state', 'country']
        const colsClass = ({ 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' } as Record<number, string>)[locationFields.length] || 'md:grid-cols-3'
        return (
          <FormField
            key={field.field_name}
            control={control}
            name={field.field_name}
            render={({ field: formField }) => {
              const locationValue = (() => {
                try {
                  if (typeof formField.value === 'string') return JSON.parse(formField.value)
                  return formField.value || {}
                } catch { return {} }
              })()
              const updateLocation = (key: string, val: string) => {
                const next = { ...locationValue, [key]: val }
                formField.onChange(JSON.stringify(next))
              }
              return (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {field.field_label}
                    {field.is_required && <span className="text-destructive ml-1">*</span>}
                  </FormLabel>
                  <div className={`grid grid-cols-1 ${colsClass} gap-3`}>
                    {locationFields.includes('city') && (
                      <FormControl>
                        <Input
                          placeholder="City"
                          value={locationValue.city || ''}
                          onChange={(e) => updateLocation('city', e.target.value)}
                        />
                      </FormControl>
                    )}
                    {locationFields.includes('state') && (
                      <FormControl>
                        <Input
                          placeholder="State / Province"
                          value={locationValue.state || ''}
                          onChange={(e) => updateLocation('state', e.target.value)}
                        />
                      </FormControl>
                    )}
                    {locationFields.includes('country') && (
                      <FormControl>
                        <Input
                          placeholder="Country"
                          value={locationValue.country || ''}
                          onChange={(e) => updateLocation('country', e.target.value)}
                        />
                      </FormControl>
                    )}
                  </div>
                  <FormDescription className="text-green-600">
                    This will be added to your candidate profile.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )
            }}
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