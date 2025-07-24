import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, File, X } from 'lucide-react'
import { useWorkerComplianceFields } from '@/hooks/useWorkerComplianceFields'
import { useWorkerCustomData } from '@/hooks/useWorkerCustomData'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface WorkerComplianceCardProps {
  worker: any
}

export function WorkerComplianceCard({ worker }: WorkerComplianceCardProps) {
  const [uploading, setUploading] = useState<string | null>(null)
  const { fields, isLoading: fieldsLoading } = useWorkerComplianceFields(worker.country)
  const { data: customData, saveWorkerData: saveCustomData, deleteWorkerData: deleteCustomData, isLoading: dataLoading } = useWorkerCustomData(worker.id)

  const getFieldValue = (fieldId: string) => {
    const data = customData.find(d => d.country_field_id === fieldId)
    return data?.field_value || ''
  }

  const getFieldFile = (fieldId: string) => {
    const data = customData.find(d => d.country_field_id === fieldId)
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

  const handleInputChange = async (fieldId: string, value: string) => {
    try {
      await saveCustomData(worker.id, fieldId, value)
    } catch (error) {
      // Error is already handled in the hook
    }
  }

  const handleFileUpload = async (fieldId: string, file: File) => {
    try {
      setUploading(fieldId)
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${worker.id}/${fieldId}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('organization-files')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('organization-files')
        .getPublicUrl(fileName)

      await saveCustomData(worker.id, fieldId, getFieldValue(fieldId), {
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size_bytes: file.size
      })
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file')
    } finally {
      setUploading(null)
    }
  }

  const handleFileRemove = async (fieldId: string) => {
    try {
      const currentData = customData.find(d => d.country_field_id === fieldId)
      if (currentData) {
        await saveCustomData(worker.id, fieldId, currentData.field_value || '')
      }
    } catch (error) {
      // Error is already handled in the hook
    }
  }

  const renderField = (field: any) => {
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
              {field.validation_rules?.find((rule: any) => rule.rule_type === 'options')?.rule_value?.split('|')?.map((option: string, index: number) => (
                <SelectItem key={index} value={option.trim()}>
                  {option.trim()}
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
        <CardTitle>Compliance Information</CardTitle>
        <p className="text-sm text-muted-foreground">
          Required compliance information for {worker.country}
        </p>
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
            {renderField(field)}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}