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

const publicApplicationSchema = z.object({
  candidate_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  skills: z.string().optional(),
  profile_summary: z.string().optional(),
})

type PublicApplicationFormData = z.infer<typeof publicApplicationSchema>

interface PublicApplicationFormProps {
  postingId: string
  jobTitle: string
  companyName: string
}

export function PublicApplicationForm({ postingId, jobTitle, companyName }: PublicApplicationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resumeFiles, setResumeFiles] = useState<File[]>([])
  const [customFieldResponses, setCustomFieldResponses] = useState<Record<string, any>>({})
  
  const { coreFields } = useCoreFields()
  const { fields: customFields, isLoading: fieldsLoading } = useJobPostingFields(postingId)
  
  const form = useForm<PublicApplicationFormData>({
    resolver: zodResolver(publicApplicationSchema),
    defaultValues: {
      candidate_name: '',
      email: '',
      phone: '',
      linkedin_url: '',
      skills: '',
      profile_summary: '',
    }
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

      // Validate required custom fields
      const missingFields = customFields
        .filter(field => field.is_required)
        .filter(field => {
          const response = customFieldResponses[field.field_name]
          return !response || (typeof response === 'string' && response.trim() === '')
        })
        .map(field => field.field_label)

      if (missingFields.length > 0) {
        toast({
          title: 'Required Fields Missing',
          description: `Please fill in the following required fields: ${missingFields.join(', ')}`,
          variant: 'destructive'
        })
        setIsSubmitting(false)
        return
      }

      // Prepare application data combining core fields and custom fields
      const applicationData = {
        ...data,
        uploadedFiles: resumeFiles,
        custom_fields: customFieldResponses,
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
      setCustomFieldResponses({})

    } catch (error) {
      console.error('Error submitting application:', error)
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting your application. Please try again.',
        variant: 'destructive'
      })
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
                  responses={customFieldResponses}
                  onResponseChange={setCustomFieldResponses}
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || resumeFiles.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Application...
                </>
              ) : resumeFiles.length === 0 ? (
                'Upload Resume to Continue'
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