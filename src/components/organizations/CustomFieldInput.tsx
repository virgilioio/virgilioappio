
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Upload, File, X, Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { CountryField, FieldSelectOption } from '@/hooks/useCountries'

interface CustomFieldInputProps {
  field: CountryField & { 
    validation_rules?: Array<{
      rule_type: string
      rule_value: string
      error_message: string
    }>
    select_options?: FieldSelectOption[]
  }
  value?: string
  fileData?: {
    url: string
    name: string
    size: number
  }
  onValueChange: (value: string) => void
  onFileChange: (file: File | null) => void
  error?: string
}

export function CustomFieldInput({ 
  field, 
  value = '', 
  fileData, 
  onValueChange, 
  onFileChange, 
  error 
}: CustomFieldInputProps) {
  const [dragOver, setDragOver] = useState(false)
  const { toast } = useToast()

  console.log('CustomFieldInput render - field:', field, 'value:', value)

  // Validate field prop early
  if (!field || typeof field !== 'object') {
    console.error('CustomFieldInput: Invalid field prop:', field)
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-md">
        <p className="text-sm text-red-700">
          Error: Invalid field configuration
        </p>
      </div>
    )
  }

  const validateValue = (inputValue: string): string | null => {
    if (!field.validation_rules) return null

    for (const rule of field.validation_rules) {
      switch (rule.rule_type) {
        case 'regex':
          if (!new RegExp(rule.rule_value).test(inputValue)) {
            return rule.error_message
          }
          break
        case 'min_length':
          if (inputValue.length < parseInt(rule.rule_value)) {
            return rule.error_message
          }
          break
        case 'max_length':
          if (inputValue.length > parseInt(rule.rule_value)) {
            return rule.error_message
          }
          break
        case 'min_value':
          if (parseFloat(inputValue) < parseFloat(rule.rule_value)) {
            return rule.error_message
          }
          break
        case 'max_value':
          if (parseFloat(inputValue) > parseFloat(rule.rule_value)) {
            return rule.error_message
          }
          break
      }
    }
    return null
  }

  const handleValueChange = (newValue: string) => {
    onValueChange(newValue)
  }

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (field.accepted_file_types) {
      try {
        const acceptedTypes = JSON.parse(field.accepted_file_types)
        if (!acceptedTypes.includes(file.type)) {
          toast({
            title: 'Invalid file type',
            description: `Please select a file of type: ${acceptedTypes.join(', ')}`,
            variant: 'destructive'
          })
          return
        }
      } catch (e) {
        console.error('Error parsing accepted file types:', e)
      }
    }

    // Validate file size
    const maxSizeMB = field.max_file_size_mb || 5
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `File size must be less than ${maxSizeMB}MB`,
        variant: 'destructive'
      })
      return
    }

    onFileChange(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const renderInput = (): JSX.Element => {
    console.log('CustomFieldInput - renderInput for field type:', field.field_type)
    console.log('Component validation check:', { 
      Input: typeof Input, 
      Textarea: typeof Textarea, 
      Select: typeof Select,
      SelectTrigger: typeof SelectTrigger,
      SelectContent: typeof SelectContent,
      SelectItem: typeof SelectItem,
      SelectValue: typeof SelectValue,
      Checkbox: typeof Checkbox,
      Button: typeof Button,
      FormField: typeof FormField
    })
    
    // Validate field_type exists
    if (!field.field_type) {
      console.error('CustomFieldInput - Missing field_type:', field)
      return (
        <div className="p-4 border border-red-200 bg-red-50 rounded-md">
          <p className="text-sm text-red-700">
            Error: Missing field type configuration
          </p>
        </div>
      )
    }
    
    let inputElement: JSX.Element | null = null
    
    switch (field.field_type) {
      case 'text':
      case 'email':
        console.log('Rendering Input component for type:', field.field_type)
        console.log('Input component check:', Input, typeof Input)
        if (!Input) {
          console.error('Input component is undefined!')
          inputElement = <div className="p-2 border border-red-500 bg-red-50 text-red-700">Input component not available</div>
        } else {
          inputElement = (
            <Input
              type={field.field_type}
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={field.placeholder_text || ''}
              className={error ? 'border-red-500' : ''}
            />
          )
        }
        break

      case 'number':
        console.log('Rendering Input component for number type')
        console.log('Input component check:', Input, typeof Input)
        if (!Input) {
          console.error('Input component is undefined!')
          inputElement = <div className="p-2 border border-red-500 bg-red-50 text-red-700">Input component not available</div>
        } else {
          inputElement = (
            <Input
              type="number"
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={field.placeholder_text || ''}
              className={error ? 'border-red-500' : ''}
            />
          )
        }
        break

      case 'textarea':
        console.log('Rendering Textarea component')
        console.log('Textarea component check:', Textarea, typeof Textarea)
        if (!Textarea) {
          console.error('Textarea component is undefined!')
          inputElement = <div className="p-2 border border-red-500 bg-red-50 text-red-700">Textarea component not available</div>
        } else {
          inputElement = (
            <Textarea
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={field.placeholder_text || ''}
              className={error ? 'border-red-500' : ''}
            />
          )
        }
        break

      case 'select':
        console.log('Rendering Select component')
        console.log('Select components check:', { Select, SelectTrigger, SelectContent, SelectItem, SelectValue })
        if (!Select || !SelectTrigger || !SelectContent || !SelectItem || !SelectValue) {
          console.error('Select components are undefined!', { Select, SelectTrigger, SelectContent, SelectItem, SelectValue })
          inputElement = <div className="p-2 border border-red-500 bg-red-50 text-red-700">Select components not available</div>
        } else {
          inputElement = (
            <Select value={value} onValueChange={handleValueChange}>
              <SelectTrigger className={error ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.placeholder_text || 'Select an option'} />
              </SelectTrigger>
              <SelectContent>
                {field.select_options?.map((option) => (
                  <SelectItem key={option.id} value={option.option_value}>
                    {option.option_label}
                  </SelectItem>
                )) || (
                  <SelectItem value="" disabled>
                    No options available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )
        }
        break

      case 'checkbox':
        console.log('Rendering Checkbox component')
        console.log('Checkbox component check:', Checkbox, typeof Checkbox)
        if (!Checkbox) {
          console.error('Checkbox component is undefined!')
          inputElement = <div className="p-2 border border-red-500 bg-red-50 text-red-700">Checkbox component not available</div>
        } else {
          inputElement = (
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.field_name}
                checked={value === 'true'}
                onCheckedChange={(checked) => handleValueChange(checked.toString())}
              />
              <label htmlFor={field.field_name} className="text-sm">
                {field.field_label}
              </label>
            </div>
          )
        }
        break

      case 'date':
        console.log('Rendering Input component for date type')
        console.log('Input component check:', Input, typeof Input)
        if (!Input) {
          console.error('Input component is undefined!')
          inputElement = <div className="p-2 border border-red-500 bg-red-50 text-red-700">Input component not available</div>
        } else {
          inputElement = (
            <Input
              type="date"
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              className={error ? 'border-red-500' : ''}
            />
          )
        }
        break

      case 'file':
        console.log('Rendering file upload component')
        console.log('File components check:', { Button, Upload, File, X, Download })
        inputElement = (
          <div className="space-y-4">
            {fileData ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted">
                <div className="flex items-center space-x-3">
                  <File className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">{fileData.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(fileData.size)}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(fileData.url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onFileChange(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                } ${error ? 'border-red-500' : ''}`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
              >
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Drag and drop a file here, or click to select
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      if (field.accepted_file_types) {
                        try {
                          const acceptedTypes = JSON.parse(field.accepted_file_types)
                          input.accept = acceptedTypes.join(',')
                        } catch (e) {
                          console.error('Error parsing accepted file types:', e)
                        }
                      }
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files
                        if (files && files[0]) {
                          handleFileSelect(files[0])
                        }
                      }
                      input.click()
                    }}
                  >
                    Select File
                  </Button>
                  {field.accepted_file_types && (
                    <p className="text-xs text-gray-500 mt-2">
                      Accepted types: {JSON.parse(field.accepted_file_types).join(', ')}
                    </p>
                  )}
                  {field.max_file_size_mb && (
                    <p className="text-xs text-gray-500">
                      Max size: {field.max_file_size_mb}MB
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )
        break

      default:
        console.warn('CustomFieldInput - Unknown field type:', field.field_type)
        inputElement = (
          <div className="p-4 border border-orange-200 bg-orange-50 rounded-md">
            <p className="text-sm text-orange-700">
              Unsupported field type: {field.field_type}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Contact support if this field type should be supported.
            </p>
          </div>
        )
    }

    // Final validation before returning
    console.log('Final inputElement check:', inputElement, typeof inputElement)
    if (!inputElement || typeof inputElement !== 'object') {
      console.error('Invalid element returned by renderInput:', inputElement)
      return (
        <div className="p-4 border border-red-500 bg-red-50 rounded-md">
          <p className="text-sm text-red-700">
            ⚠️ Failed to render input component
          </p>
          <p className="text-xs text-red-600 mt-1">
            Field type: {field.field_type}
          </p>
        </div>
      )
    }

    return inputElement
  }

  // Get the input element - this is guaranteed to be a valid JSX element
  const inputElement = renderInput()
  console.log('Final inputElement before render:', inputElement)

  // Handle checkbox special case
  if (field.field_type === 'checkbox') {
    return (
      <div className="space-y-2">
        {inputElement}
        {field.help_text && (
          <p className="text-sm text-muted-foreground">{field.help_text}</p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  // Render with FormField wrapper for all other field types
  console.log('FormField component check:', FormField, typeof FormField)
  if (!FormField) {
    console.error('FormField component is undefined!')
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">{field.field_label}</label>
        {inputElement}
        {field.help_text && (
          <p className="text-sm text-muted-foreground">{field.help_text}</p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <FormField
      label={field.field_label}
      required={field.is_required}
      htmlFor={field.field_name}
    >
      {inputElement}
      {field.help_text && (
        <p className="text-sm text-muted-foreground mt-1">{field.help_text}</p>
      )}
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </FormField>
  )
}
