
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Candidate, CreateCandidateData, UpdateCandidateData } from '@/hooks/useCandidates'

const candidateFormSchema = z.object({
  candidate_name: z.string().min(1, 'Name is required'),
  candidate_email: z.string().email('Please enter a valid email'),
  notes: z.string().optional(),
  resume_url: z.string().url('Please enter a valid URL').optional().or(z.literal(''))
})

type CandidateFormData = z.infer<typeof candidateFormSchema>

interface CandidateFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateCandidateData | UpdateCandidateData) => Promise<void>
  candidate?: Candidate | null
  jobId: string
  isLoading: boolean
}

export function CandidateForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  candidate, 
  jobId, 
  isLoading 
}: CandidateFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const form = useForm<CandidateFormData>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: {
      candidate_name: '',
      candidate_email: '',
      notes: '',
      resume_url: ''
    }
  })

  useEffect(() => {
    if (candidate) {
      form.reset({
        candidate_name: candidate.candidate_name,
        candidate_email: candidate.candidate_email,
        notes: candidate.notes || '',
        resume_url: candidate.resume_url || ''
      })
    } else {
      form.reset({
        candidate_name: '',
        candidate_email: '',
        notes: '',
        resume_url: ''
      })
    }
  }, [candidate, form])

  const handleSubmit = async (data: CandidateFormData) => {
    setIsSubmitting(true)
    
    try {
      const submitData = {
        ...data,
        notes: data.notes || null,
        resume_url: data.resume_url || null
      }

      if (candidate) {
        await onSubmit(submitData)
      } else {
        await onSubmit({
          ...submitData,
          job_id: jobId
        })
      }
      
      form.reset()
      onClose()
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="candidate_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter candidate name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="candidate_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="candidate@example.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="resume_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resume URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com/resume.pdf" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any notes about the candidate..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || isLoading}
              >
                {isSubmitting ? 'Saving...' : candidate ? 'Update' : 'Add'} Candidate
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
