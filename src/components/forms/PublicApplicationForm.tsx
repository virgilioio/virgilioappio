import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CoreFieldsRenderer } from './CoreFieldsRenderer'
import { useCoreFields } from '@/hooks/useCoreFields'
import { useJobPostingFields } from '@/hooks/useJobPostingFields'
import { ApplicationFieldsRenderer } from './ApplicationFieldsRenderer'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

// Create dynamic schema based on custom fields
const createPublicApplicationSchema = (customFields: any[]) => {
  const baseSchema = {
    candidate_name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    linkedin_url: z.string().url().optional().or(z.literal('')),
    skills: z.string().optional(),
    profile_summary: z.string().optional(),
  }

  // Add custom field validations
  const customFieldSchema = customFields.reduce((acc, field) => {
    if (field.is_required) {
      if (field.field_type === 'checkbox') {
        acc[field.field_name] = z.boolean().refine(val => val === true, {
          message: `${field.field_label} is required`
        })
      } else {
        acc[field.field_name] = z.string().min(1, `${field.field_label} is required`)
      }
    } else {
      if (field.field_type === 'checkbox') {
        acc[field.field_name] = z.boolean().optional()
      } else {
        acc[field.field_name] = z.string().optional()
      }
    }
    return acc
  }, {} as Record<string, any>)

  return z.object({ ...baseSchema, ...customFieldSchema })
}

type PublicApplicationFormData = Record<string, any>

interface PublicApplicationFormProps {
  postingId: string
  jobTitle: string
  companyName: string
}

export function PublicApplicationForm({ postingId, jobTitle, companyName }: PublicApplicationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resumeFiles, setResumeFiles] = useState<File[]>([])
  
  const { coreFields } = useCoreFields()
  const { fields: customFields, isLoading: fieldsLoading } = useJobPostingFields(postingId)
  
  // Create dynamic schema and default values
  const publicApplicationSchema = createPublicApplicationSchema(customFields)
  
  const defaultValues = {
    candidate_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    skills: '',
    profile_summary: '',
    ...customFields.reduce((acc, field) => {
      acc[field.field_name] = field.field_type === 'checkbox' ? false : ''
      return acc
    }, {} as Record<string, any>)
  }
  
  const form = useForm<PublicApplicationFormData>({
    resolver: zodResolver(publicApplicationSchema),
    defaultValues,
    mode: 'onChange' // Enable real-time validation
  })

  const onSubmit = async (data: PublicApplicationFormData) => {
    setIsSubmitting(true)
    
    try {
      // Validate resume upload (always required for job applications)
      if (!resumeFiles || resumeFiles.length === 0) {
        toast({
          title: 'Resume Required',
          description: 'Please upload your resume to submit your application.',
          variant: 'destructive'
        })
        setIsSubmitting(false)
        return
      }

      // Separate core fields from custom fields
      const { candidate_name, email, phone, linkedin_url, skills, profile_summary, ...customFieldData } = data

      // Prepare application data
      const applicationData = {
        candidate_name,
        email,
        phone,
        linkedin_url,
        skills,
        profile_summary,
        uploadedFiles: resumeFiles,
        custom_fields: customFieldData,
        posting_id: postingId
      }

      const { data: result, error } = await supabase.functions.invoke('public-submit-application', {
        body: applicationData
      })

      if (error) throw error

      toast({
        title: 'Application Submitted!',
        description: 'Thank you for your application. We will review it and get back to you soon.',
      })

      // Reset form
      form.reset()
      setResumeFiles([])

    } catch (error) {
      console.error('Error submitting application:', error)
      
      // Handle specific edge function errors
      if (error?.message?.includes('same_job_cooldown')) {
        toast({
          title: 'Application Already Submitted',
          description: 'You have already applied to this job recently. Please wait before applying again.',
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Submission Failed',
          description: 'There was an error submitting your application. Please try again.',
          variant: 'destructive'
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (fieldsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Apply for {jobTitle}</CardTitle>
        <p className="text-muted-foreground">at {companyName}</p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Core Fields */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <CoreFieldsRenderer
                control={form.control}
                onResumeUpload={(files) => setResumeFiles(files)}
                resumeParsing={{
                  isLoading: false,
                  error: null
                }}
              />
              {resumeFiles.length === 0 && (
                <div className="text-sm text-destructive flex items-center gap-2 mt-2">
                  <span>⚠️ Resume is required for all applications</span>
                </div>
              )}
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Additional Questions</h3>
                <ApplicationFieldsRenderer
                  fields={customFields}
                  control={form.control}
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || resumeFiles.length === 0 || !form.formState.isValid}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Application...
                </>
              ) : resumeFiles.length === 0 ? (
                'Upload Resume to Continue'
              ) : !form.formState.isValid ? (
                'Please Fill Required Fields'
              ) : (
                'Submit Application'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}