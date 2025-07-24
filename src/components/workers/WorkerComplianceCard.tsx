import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, File, X, Edit, Save, XCircle } from 'lucide-react'
import { useWorkerComplianceFields } from '@/hooks/useWorkerComplianceFields'
import { useWorkerComplianceData } from '@/hooks/useWorkerComplianceData'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { PermissionGate } from '@/components/auth/PermissionGate'

interface WorkerComplianceCardProps {
  worker: any
}

export function WorkerComplianceCard({ worker }: WorkerComplianceCardProps) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const { fields, isLoading: fieldsLoading } = useWorkerComplianceFields(worker.country)
  const { data: complianceData, saveWorkerData, deleteWorkerData, isLoading: dataLoading } = useWorkerComplianceData(worker.id)

  // Initialize local values when data loads (only once or when not editing)
  useEffect(() => {
    if (!isEditing) {
      const initialValues: Record<string, string> = {}
      complianceData.forEach(data => {
        initialValues[data.worker_compliance_field_id] = data.field_value || ''
      })
      setLocalValues(initialValues)
    }
  }, [complianceData, isEditing])

  // Debounced save function
  const debouncedSave = useCallback(
    async (fieldId: string, value: string) => {
      try {
        await saveWorkerData(worker.id, fieldId, value)
        console.log('Data saved successfully')
      } catch (error) {
        console.error('Error saving data:', error)
      }
    },
    [saveWorkerData, worker.id]
  )

  // Create debounced version with 1000ms delay and prevent loops
  useEffect(() => {
    if (!isEditing) return // Only save when editing

    const timeouts: Record<string, NodeJS.Timeout> = {}
    
    Object.entries(localValues).forEach(([fieldId, value]) => {
      // Only save if there's actually a value and it's different from saved value
      const savedData = complianceData.find(d => d.worker_compliance_field_id === fieldId)
      const savedValue = savedData?.field_value || ''
      
      if (value !== savedValue && value.trim() !== '') {
        if (timeouts[fieldId]) clearTimeout(timeouts[fieldId])
        
        timeouts[fieldId] = setTimeout(() => {
          debouncedSave(fieldId, value)
        }, 1000)
      }
    })

    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout))
    }
  }, [localValues, isEditing, debouncedSave, complianceData])

  const getFieldValue = (fieldId: string) => {
    // Use local value if editing, otherwise use saved value
    if (isEditing && localValues[fieldId] !== undefined) {
      return localValues[fieldId]
    }
    const data = complianceData.find(d => d.worker_compliance_field_id === fieldId)
    return data?.field_value || ''
  }

  const getFieldFile = (fieldId: string) => {
    const data = complianceData.find(d => d.worker_compliance_field_id === fieldId)
    return data?.file_url ? {
      url: data.file_url,
      name: data.file_name || 'File',
      size: data.file_size_bytes || 0
    } : null
  }

  const getFieldStatus = (field: any) => {
    const fieldValue = getFieldValue(field.id)
    const fieldFile = getFieldFile(field.id)
    
    if (field.field_type === 'file') {
      return fieldFile ? 'completed' : 'pending'
    } else if (field.field_type === 'checkbox') {
      return fieldValue === 'true' ? 'completed' : 'pending'
    } else {
      return fieldValue.trim() ? 'completed' : 'pending'
    }
  }

  const validateField = (field: any, value: string): { isValid: boolean; message?: string } => {
    if (!field.validation_rules || field.validation_rules.length === 0) {
      return { isValid: true }
    }

    for (const rule of field.validation_rules) {
      const ruleType = rule.rule_type
      const ruleValue = rule.rule_value
      const errorMessage = rule.error_message

      switch (ruleType) {
        case 'min_length':
          if (value.length < parseInt(ruleValue)) {
            return { isValid: false, message: errorMessage }
          }
          break
        case 'max_length':
          if (value.length > parseInt(ruleValue)) {
            return { isValid: false, message: errorMessage }
          }
          break
        case 'exact_length':
          if (value.length !== parseInt(ruleValue)) {
            return { isValid: false, message: errorMessage }
          }
          break
        case 'alphanumeric':
          if (!/^[a-zA-Z0-9]*$/.test(value)) {
            return { isValid: false, message: errorMessage }
          }
          break
        case 'numeric_only':
          if (!/^[0-9]*$/.test(value)) {
            return { isValid: false, message: errorMessage }
          }
          break
        case 'min_value':
          if (field.field_type === 'number' && parseFloat(value) < parseFloat(ruleValue)) {
            return { isValid: false, message: errorMessage }
          }
          break
        case 'max_value':
          if (field.field_type === 'number' && parseFloat(value) > parseFloat(ruleValue)) {
            return { isValid: false, message: errorMessage }
          }
          break
        case 'pattern':
          try {
            const regex = new RegExp(ruleValue)
            if (!regex.test(value)) {
              return { isValid: false, message: errorMessage }
            }
          } catch (e) {
            console.error('Invalid regex pattern:', ruleValue)
          }
          break
      }
    }

    return { isValid: true }
  }

  const handleInputChange = (fieldId: string, value: string) => {
    console.log('handleInputChange called:', { fieldId, value, isEditing })
    
    // Only allow input changes when in edit mode
    if (!isEditing) {
      console.log('Not in edit mode, ignoring input change')
      return
    }

    // Update local state immediately for responsive UI
    setLocalValues(prev => ({
      ...prev,
      [fieldId]: value
    }))
    
    // Find the field to validate for error display
    const field = fields.find(f => f.id === fieldId)
    
    if (field) {
      const validation = validateField(field, value)
      console.log('Validation result:', validation)
      
      if (!validation.isValid && validation.message) {
        // Set validation error for display
        setValidationErrors(prev => ({
          ...prev,
          [fieldId]: validation.message!
        }))
      } else {
        // Clear validation error if it exists
        setValidationErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[fieldId]
          return newErrors
        })
      }
    }
  }

  const handleFileUpload = async (fieldId: string, file: File) => {
    console.log('handleFileUpload called:', { fieldId, fileName: file.name, fileSize: file.size })
    
    try {
      setUploading(fieldId)
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${worker.id}/${fieldId}/${Date.now()}.${fileExt}`
      
      console.log('Uploading file to:', fileName)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('organization-files')
        .upload(fileName, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      console.log('Upload successful:', uploadData)

      const { data: urlData } = supabase.storage
        .from('organization-files')
        .getPublicUrl(fileName)

      console.log('Public URL generated:', urlData.publicUrl)

      await saveWorkerData(worker.id, fieldId, getFieldValue(fieldId), {
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size_bytes: file.size
      })

      console.log('File data saved to database')
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file: ' + (error as any).message)
    } finally {
      setUploading(null)
    }
  }

  const handleFileRemove = async (fieldId: string) => {
    try {
      const currentData = complianceData.find(d => d.worker_compliance_field_id === fieldId)
      if (currentData) {
        await saveWorkerData(worker.id, fieldId, currentData.field_value || '')
      }
    } catch (error) {
      // Error is already handled in the hook
    }
  }

  const renderFieldDisplay = (field: any) => {
    const fieldValue = getFieldValue(field.id)
    const fieldFile = getFieldFile(field.id)

    switch (field.field_type) {
      case 'checkbox':
        return (
          <div className="p-2 rounded bg-muted/50">
            {fieldValue === 'true' ? 'Yes' : 'No'}
          </div>
        )
      case 'file':
        return fieldFile ? (
          <div className="flex items-center gap-2 p-2 border rounded">
            <File className="h-4 w-4" />
            <span className="flex-1 text-sm">{fieldFile.name}</span>
          </div>
        ) : (
          <div className="p-2 rounded bg-muted/50 text-muted-foreground text-sm">
            No file uploaded
          </div>
        )
      case 'select':
        const selectedOption = field.select_options?.find((opt: any) => opt.option_value === fieldValue)
        return (
          <div className="p-2 rounded bg-muted/50">
            {selectedOption?.option_label || fieldValue || 'Not selected'}
          </div>
        )
      default:
        return (
          <div className="p-2 rounded bg-muted/50">
            {fieldValue || 'Not provided'}
          </div>
        )
    }
  }

  const renderFieldEdit = (field: any) => {
    const fieldValue = getFieldValue(field.id)
    const fieldFile = getFieldFile(field.id)

    switch (field.field_type) {
      case 'text':
        return (
          <Input
            value={fieldValue}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder_text || ''}
          />
        )

      case 'textarea':
        return (
          <Textarea
            value={fieldValue}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder_text || ''}
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={fieldValue}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder_text || ''}
          />
        )

      case 'email':
        return (
          <Input
            type="email"
            value={fieldValue}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder_text || ''}
          />
        )

      case 'date':
        return (
          <Input
            type="date"
            value={fieldValue}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
          />
        )

      case 'checkbox':
        return (
          <Checkbox
            checked={fieldValue === 'true'}
            onCheckedChange={(checked) => handleInputChange(field.id, checked ? 'true' : 'false')}
          />
        )

      case 'select':
        return (
          <Select value={fieldValue} onValueChange={(value) => handleInputChange(field.id, value)}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder_text || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {field.select_options?.map((option: any) => (
                <SelectItem key={option.id} value={option.option_value}>
                  {option.option_label}
                </SelectItem>
              )) || []}
            </SelectContent>
          </Select>
        )

      case 'file':
        return (
          <div className="space-y-2">
            {fieldFile ? (
              <div className="flex items-center gap-2 p-2 border rounded">
                <File className="h-4 w-4" />
                <span className="flex-1 text-sm">{fieldFile.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFileRemove(field.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(field.id, file)
                  }}
                  className="hidden"
                  id={`file-${field.id}`}
                  accept={field.accepted_file_types || '*'}
                />
                <label htmlFor={`file-${field.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading === field.id}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading === field.id ? 'Uploading...' : 'Upload File'}
                  </Button>
                </label>
              </div>
            )}
          </div>
        )

      default:
        return (
          <Input
            value={fieldValue}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder_text || ''}
          />
        )
    }
  }

  if (fieldsLoading || dataLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading compliance fields...</p>
        </CardContent>
      </Card>
    )
  }

  if (!fields.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No compliance fields configured for {worker.country || 'this country'}.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Compliance Information</CardTitle>
            <p className="text-sm text-muted-foreground">
              Required compliance information for {worker.country}
            </p>
          </div>
          <PermissionGate permission="canManageWorkers">
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false)
                      toast.success('Changes saved')
                    }}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </PermissionGate>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={field.id}>
                {field.field_label}
                {field.is_required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Badge 
                variant={getFieldStatus(field) === 'completed' ? 'default' : 'secondary'}
                className={getFieldStatus(field) === 'completed' 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                }
              >
                {getFieldStatus(field) === 'completed' ? 'Completed' : 'Pending'}
              </Badge>
            </div>
            {field.help_text && (
              <p className="text-xs text-muted-foreground">{field.help_text}</p>
            )}
            {isEditing ? renderFieldEdit(field) : renderFieldDisplay(field)}
            {validationErrors[field.id] && (
              <p className="text-xs text-destructive">{validationErrors[field.id]}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}