import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { EnhancedResumeDropzone } from '@/components/candidates/EnhancedResumeDropzone'
import { useCoreFields, CoreField } from '@/hooks/useCoreFields'
import { Control, FieldValues, Path } from 'react-hook-form'

interface CoreFieldsRendererProps<T extends FieldValues> {
  control: Control<T>
  fields?: CoreField[]
  onResumeUpload?: (files: File[]) => void
  resumeParsing?: {
    isLoading: boolean
    error: string | null
  }
}

export function CoreFieldsRenderer<T extends FieldValues>({ 
  control, 
  fields,
  onResumeUpload,
  resumeParsing
}: CoreFieldsRendererProps<T>) {
  const { coreFields } = useCoreFields()
  const fieldsToRender = fields || coreFields

  const renderField = (field: CoreField) => {
    const fieldName = field.field_name as Path<T>

    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <FormField
            key={field.field_name}
            control={control}
            name={fieldName}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input 
                    {...formField}
                    type={field.field_type}
                    placeholder={field.placeholder_text}
                  />
                </FormControl>
                {field.help_text && (
                  <p className="text-sm text-muted-foreground">{field.help_text}</p>
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
            name={fieldName}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Textarea 
                    {...formField}
                    placeholder={field.placeholder_text}
                    rows={4}
                  />
                </FormControl>
                {field.help_text && (
                  <p className="text-sm text-muted-foreground">{field.help_text}</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case 'file':
        if (field.field_name === 'resume' && onResumeUpload) {
          return (
            <FormItem key={field.field_name}>
              <FormLabel>
                {field.field_label}
                {field.is_required && <span className="text-destructive ml-1">*</span>}
              </FormLabel>
              <EnhancedResumeDropzone
                onUpload={async (file: File) => {
                  onResumeUpload([file])
                }}
                maxSizeMb={field.max_file_size_mb}
                accept={field.accepted_file_types}
                isUploading={resumeParsing?.isLoading}
              />
              {field.help_text && (
                <p className="text-sm text-muted-foreground">{field.help_text}</p>
              )}
            </FormItem>
          )
        }
        return null

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {fieldsToRender.map(renderField)}
    </div>
  )
}