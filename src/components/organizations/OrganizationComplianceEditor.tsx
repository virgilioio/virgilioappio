
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Upload, Download, X, Save, Shield } from 'lucide-react'
import { useCountryFields } from '@/hooks/useCountryFields'
import { useOrganizationCustomData } from '@/hooks/useOrganizationCustomData'
import { toast } from '@/hooks/use-toast'

interface Organization {
  id: string
  name: string
  country: string
  status: 'active' | 'inactive'
  created_at: string
}

interface OrganizationComplianceEditorProps {
  organization: Organization
  onSave: () => void
  onCancel: () => void
}

export function OrganizationComplianceEditor({ 
  organization, 
  onSave, 
  onCancel 
}: OrganizationComplianceEditorProps) {
  const { fields, isLoading: fieldsLoading } = useCountryFields(organization.country)
  const { customData, saveCustomData, uploadFile, deleteFile, isLoading: customDataLoading } = useOrganizationCustomData(organization.id)
  const [uploading, setUploading] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Create dynamic form schema based on fields
  const createFormSchema = () => {
    const schemaObject: Record<string, any> = {}
    
    fields.forEach(field => {
      if (field.is_required) {
        if (field.field_type === 'file') {
          // For required files, check if there's already an uploaded file
          const existingFile = customData.find(data => data.country_field_id === field.id)?.file_url
          if (!existingFile) {
            schemaObject[field.id] = z.string().min(1, `${field.field_label} is required`)
          } else {
            schemaObject[field.id] = z.string().optional()
          }
        } else {
          schemaObject[field.id] = z.string().min(1, `${field.field_label} is required`)
        }
      } else {
        schemaObject[field.id] = z.string().optional()
      }
    })

    return z.object(schemaObject)
  }

  const form = useForm({
    resolver: zodResolver(createFormSchema()),
    defaultValues: fields.reduce((acc, field) => {
      const existingData = customData.find(data => data.country_field_id === field.id)
      acc[field.id] = existingData?.field_value || ''
      return acc
    }, {} as Record<string, string>)
  })

  const getCustomFieldValue = (fieldId: string) => {
    const data = customData.find(data => data.country_field_id === fieldId)
    return data?.field_value || ''
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

  const handleFileUpload = async (fieldId: string, file: File, fieldName: string) => {
    setUploading(fieldId)
    try {
      const fileData = await uploadFile(file, organization.id, fieldName)
      await saveCustomData(organization.id, fieldId, undefined, fileData)
      toast({
        title: 'Success',
        description: 'File uploaded successfully'
      })
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive'
      })
    } finally {
      setUploading(null)
    }
  }

  const handleFileDelete = async (fieldId: string) => {
    try {
      const fileData = getCustomFieldFileData(fieldId)
      if (fileData?.url) {
        await deleteFile(fileData.url)
      }
      // Clear the custom data entry
      const existingData = customData.find(data => data.country_field_id === fieldId)
      if (existingData) {
        await saveCustomData(organization.id, fieldId, '', undefined)
      }
      toast({
        title: 'Success',
        description: 'File deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting file:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive'
      })
    }
  }

  const handleSubmit = async (data: Record<string, string>) => {
    setIsSaving(true)
    try {
      // Save all text field values
      await Promise.all(
        Object.entries(data).map(([fieldId, value]) => {
          const field = fields.find(f => f.id === fieldId)
          if (field && field.field_type !== 'file') {
            return saveCustomData(organization.id, fieldId, value)
          }
          return Promise.resolve()
        })
      )

      toast({
        title: 'Success',
        description: 'Compliance information updated successfully'
      })
      onSave()
    } catch (error) {
      console.error('Error saving compliance data:', error)
      toast({
        title: 'Error',
        description: 'Failed to save compliance information',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (fieldsLoading || customDataLoading) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Loading Compliance Information...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-muted/40 rounded w-1/4 mb-2"></div>
                <div className="h-10 bg-muted/40 rounded w-full"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (fields.length === 0) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Country Compliance Information - Edit Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No additional compliance fields required for {organization.country}.
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={onSave}>
                Done
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Country Compliance Information - Edit Mode
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Update the compliance information required for {organization.country}
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {fields.map((field) => {
              const fileData = getCustomFieldFileData(field.id)
              
              return (
                <div key={field.id}>
                  {field.field_type === 'file' ? (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {field.field_label}
                        {field.is_required && <span className="text-destructive">*</span>}
                      </FormLabel>
                      
                      {fileData ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{fileData.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(fileData.size)}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(fileData.url, '_blank')}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleFileDelete(field.id)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Upload {field.field_label}</p>
                              <p className="text-xs text-muted-foreground">
                                {field.accepted_file_types || 'Any file type'} • Max {field.max_file_size_mb}MB
                              </p>
                            </div>
                            <input
                              type="file"
                              accept={field.accepted_file_types || undefined}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  if (file.size > (field.max_file_size_mb || 5) * 1024 * 1024) {
                                    toast({
                                      title: 'Error',
                                      description: `File size exceeds ${field.max_file_size_mb}MB limit`,
                                      variant: 'destructive'
                                    })
                                    return
                                  }
                                  handleFileUpload(field.id, file, field.field_name)
                                }
                              }}
                              disabled={uploading === field.id}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                          {uploading === field.id && (
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              Uploading...
                            </div>
                          )}
                        </div>
                      )}
                      
                      {field.help_text && (
                        <FormDescription>{field.help_text}</FormDescription>
                      )}
                    </FormItem>
                  ) : field.field_type === 'select' ? (
                    <FormField
                      control={form.control}
                      name={field.id}
                      render={({ field: formField }) => (
                        <FormItem>
                          <FormLabel>
                            {field.field_label}
                            {field.is_required && <span className="text-destructive ml-1">*</span>}
                          </FormLabel>
                          <Select onValueChange={formField.onChange} value={formField.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder_text || `Select ${field.field_label}`} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {field.select_options?.map((option) => (
                                <SelectItem key={option.option_value} value={option.option_value}>
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
                  ) : (
                    <FormField
                      control={form.control}
                      name={field.id}
                      render={({ field: formField }) => (
                        <FormItem>
                          <FormLabel>
                            {field.field_label}
                            {field.is_required && <span className="text-destructive ml-1">*</span>}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={field.placeholder_text || `Enter ${field.field_label}`}
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
                  )}
                </div>
              )
            })}

            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || uploading !== null}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
