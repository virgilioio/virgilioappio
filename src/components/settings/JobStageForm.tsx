import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useJobStages, JobStage, CreateJobStageInput, StageType } from '@/hooks/useJobStages'

const stageTypes = [
  { value: 'application', label: 'Application' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'reference_check', label: 'Reference Check' },
  { value: 'offer', label: 'Offer' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'custom', label: 'Custom' }
]

const priorityOptions = [
  { value: '1', label: 'First' },
  { value: '2', label: 'Second' },
  { value: '3', label: 'Third' },
  { value: '4', label: 'Fourth' },
  { value: '5', label: 'Fifth' },
  { value: '99', label: 'Last' }
]

const formSchema = z.object({
  stage_name: z.string().min(1, 'Stage name is required'),
  stage_type: z.string().min(1, 'Stage type is required'),
  stage_description: z.string().optional(),
  is_default: z.boolean().default(false),
  stage_priority: z.string().optional()
})

type FormData = z.infer<typeof formSchema>

interface JobStageFormProps {
  stage?: JobStage
  onSuccess: () => void
  onCancel: () => void
}

export function JobStageForm({ stage, onSuccess, onCancel }: JobStageFormProps) {
  const { createStage, updateStage, isCreating, isUpdating } = useJobStages()
  const [showPriority, setShowPriority] = useState(stage?.is_default || false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stage_name: stage?.stage_name || '',
      stage_type: stage?.stage_type || '',
      stage_description: stage?.stage_description || '',
      is_default: stage?.is_default || false,
      stage_priority: stage?.stage_priority?.toString() || ''
    }
  })

  const watchIsDefault = form.watch('is_default')

  useEffect(() => {
    setShowPriority(watchIsDefault)
    if (!watchIsDefault) {
      form.setValue('stage_priority', '')
    }
  }, [watchIsDefault, form])

  const onSubmit = async (data: FormData) => {
    try {
      const submitData: CreateJobStageInput = {
        stage_name: data.stage_name,
        stage_type: data.stage_type as StageType,
        stage_description: data.stage_description || undefined,
        is_default: data.is_default,
        stage_priority: data.is_default && data.stage_priority ? parseInt(data.stage_priority) : undefined
      }

      if (stage) {
        await updateStage(stage.id, submitData)
      } else {
        await createStage(submitData)
      }
      
      onSuccess()
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const isLoading = isCreating || isUpdating

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label="Stage Name"
        required
        error={form.formState.errors.stage_name?.message}
      >
        <Input
          {...form.register('stage_name')}
          placeholder="Enter stage name"
          disabled={isLoading}
        />
      </FormField>

      <FormField
        label="Stage Type"
        required
        error={form.formState.errors.stage_type?.message}
      >
        <Select
          value={form.watch('stage_type')}
          onValueChange={(value) => form.setValue('stage_type', value as StageType)}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select stage type" />
          </SelectTrigger>
          <SelectContent>
            {stageTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        label="Stage Description"
        error={form.formState.errors.stage_description?.message}
      >
        <Textarea
          {...form.register('stage_description')}
          placeholder="Enter stage description"
          disabled={isLoading}
          rows={3}
        />
      </FormField>

      <FormField>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_default"
            checked={form.watch('is_default')}
            onCheckedChange={(checked) => form.setValue('is_default', !!checked)}
            disabled={isLoading}
          />
          <label htmlFor="is_default" className="text-sm font-medium">
            Stage Default
          </label>
        </div>
      </FormField>

      {showPriority && (
        <FormField
          label="Stage Priority"
          error={form.formState.errors.stage_priority?.message}
        >
          <Select
            value={form.watch('stage_priority')}
            onValueChange={(value) => form.setValue('stage_priority', value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : stage ? 'Update Stage' : 'Create Stage'}
        </Button>
      </div>
    </form>
  )
}