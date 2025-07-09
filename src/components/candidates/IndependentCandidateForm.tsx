import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Upload, Loader } from 'lucide-react'
import { CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { getSkillColor } from '@/utils/skillColors'

const candidateSchema = z.object({
  candidate_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  location_country: z.string().optional(),
  location_state: z.string().optional(),
  location_city: z.string().optional(),
  salary_amount: z.number().optional(),
  salary_currency: z.string().optional(),
  salary_period: z.string().optional(),
  profile_summary: z.string().optional(),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  resume_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  status: z.string().optional(),
  source: z.string().optional(),
})

type CandidateFormData = z.infer<typeof candidateSchema>

interface IndependentCandidateFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateIndependentCandidateData) => Promise<void>
  isLoading: boolean
  initialData?: Partial<CreateIndependentCandidateData>
  title?: string
}

export function IndependentCandidateForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  initialData,
  title = "Add New Candidate"
}: IndependentCandidateFormProps) {
  const [skills, setSkills] = useState<string[]>(initialData?.skills || [])
  const [newSkill, setNewSkill] = useState('')
  const [isProcessingResume, setIsProcessingResume] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      candidate_name: initialData?.candidate_name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      location_country: initialData?.location_country || '',
      location_state: initialData?.location_state || '',
      location_city: initialData?.location_city || '',
      salary_amount: initialData?.salary_amount || undefined,
      salary_currency: initialData?.salary_currency || 'USD',
      salary_period: initialData?.salary_period || 'annually',
      profile_summary: initialData?.profile_summary || '',
      linkedin_url: initialData?.linkedin_url || '',
      resume_url: initialData?.resume_url || '',
      status: initialData?.status || 'available',
      source: initialData?.source || 'direct',
    }
  })

  const salary_currency = watch('salary_currency')
  const salary_period = watch('salary_period')
  const status = watch('status')
  const source = watch('source')

  const handleFormSubmit = async (data: CandidateFormData) => {
    try {
      const formattedData: CreateIndependentCandidateData = {
        candidate_name: data.candidate_name,
        email: data.email || null,
        phone: data.phone || null,
        location_country: data.location_country || null,
        location_state: data.location_state || null,
        location_city: data.location_city || null,
        salary_amount: data.salary_amount || null,
        salary_currency: data.salary_currency || null,
        salary_period: data.salary_period || null,
        profile_summary: data.profile_summary || null,
        linkedin_url: data.linkedin_url || null,
        resume_url: data.resume_url || null,
        skills: skills.length > 0 ? skills : null,
        status: data.status || 'available',
        source: data.source || 'direct',
      }

      await onSubmit(formattedData)
      handleClose()
    } catch (error) {
      console.error('Error submitting candidate form:', error)
    }
  }

  const handleClose = () => {
    reset()
    setSkills([])
    setNewSkill('')
    onClose()
  }

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()])
      setNewSkill('')
    }
  }

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill()
    }
  }

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file only.',
        variant: 'destructive'
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 5MB.',
        variant: 'destructive'
      })
      return
    }

    setIsProcessingResume(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data: response, error: functionError } = await supabase.functions.invoke('process-resume', {
        body: formData,
      })

      if (functionError) {
        throw new Error(functionError.message || 'Function invocation failed')
      }

      if (response?.success && response?.structured_profile) {
        const profile = response.structured_profile
        
        // Auto-fill form fields
        if (profile.candidate_name) {
          setValue('candidate_name', profile.candidate_name)
        }
        if (profile.email) {
          setValue('email', profile.email)
        }
        if (profile.phone) {
          setValue('phone', profile.phone)
        }
        if (profile.linkedin_url) {
          setValue('linkedin_url', profile.linkedin_url)
        }
        if (profile.location_city) {
          setValue('location_city', profile.location_city)
        }
        if (profile.location_state) {
          setValue('location_state', profile.location_state)
        }
        if (profile.location_country) {
          setValue('location_country', profile.location_country)
        }
        if (profile.salary_amount) {
          setValue('salary_amount', profile.salary_amount)
        }
        if (profile.salary_currency) {
          setValue('salary_currency', profile.salary_currency)
        }
        if (profile.salary_period) {
          setValue('salary_period', profile.salary_period)
        }
        
        // Combine profile summary sections
        let combinedSummary = ''
        if (profile.profile_summary) {
          if (profile.profile_summary.about_me) {
            combinedSummary += profile.profile_summary.about_me + '\n\n'
          }
          if (profile.profile_summary.experience_highlights && profile.profile_summary.experience_highlights.length > 0) {
            combinedSummary += 'Experience Highlights:\n'
            profile.profile_summary.experience_highlights.forEach((highlight: string) => {
              combinedSummary += `• ${highlight}\n`
            })
            combinedSummary += '\n'
          }
          if (profile.profile_summary.key_competencies && profile.profile_summary.key_competencies.length > 0) {
            combinedSummary += 'Key Competencies: ' + profile.profile_summary.key_competencies.join(', ')
          }
        }
        if (combinedSummary) {
          setValue('profile_summary', combinedSummary.trim())
        }
        
        // Set skills
        if (profile.skills && profile.skills.length > 0) {
          setSkills(profile.skills)
        }

        toast({
          title: '✅ Resume processed successfully',
          description: 'Form has been auto-filled with AI-extracted data. Please review and edit as needed.',
        })
      } else {
        throw new Error(response?.error || 'Failed to process resume')
      }
    } catch (error) {
      console.error('Resume processing error:', error)
      toast({
        title: 'Resume processing failed',
        description: 'We couldn\'t extract the resume content. Please enter manually.',
        variant: 'destructive'
      })
    } finally {
      setIsProcessingResume(false)
      // Reset file input
      event.target.value = ''
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {initialData ? 'Update candidate information' : 'Add a new candidate to your talent database'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Resume Upload */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Resume Upload (Optional)</h3>
            <div className="space-y-2">
              <Label htmlFor="resume">Upload Resume (PDF only, max 5MB)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  disabled={isProcessingResume || isLoading}
                  className="file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground"
                />
                {isProcessingResume && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing...
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a PDF resume to auto-fill the form with extracted information.
              </p>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidate_name">Full Name *</Label>
                <Input
                  id="candidate_name"
                  {...register('candidate_name')}
                  placeholder="John Doe"
                />
                {errors.candidate_name && (
                  <p className="text-sm text-destructive">{errors.candidate_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="john@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value) => setValue('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="interviewing">Interviewing</SelectItem>
                    <SelectItem value="hired">Hired</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Location</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location_country">Country</Label>
                <Input
                  id="location_country"
                  {...register('location_country')}
                  placeholder="United States"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_state">State/Province</Label>
                <Input
                  id="location_state"
                  {...register('location_state')}
                  placeholder="California"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_city">City</Label>
                <Input
                  id="location_city"
                  {...register('location_city')}
                  placeholder="San Francisco"
                />
              </div>
            </div>
          </div>

          {/* Salary Expectations */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Salary Expectations</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary_amount">Amount</Label>
                <Input
                  id="salary_amount"
                  type="number"
                  {...register('salary_amount', { valueAsNumber: true })}
                  placeholder="100000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary_currency">Currency</Label>
                <Select value={salary_currency} onValueChange={(value) => setValue('salary_currency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="MXN">MXN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary_period">Period</Label>
                <Select value={salary_period} onValueChange={(value) => setValue('salary_period', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">URLs</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input
                  id="linkedin_url"
                  {...register('linkedin_url')}
                  placeholder="https://linkedin.com/in/johndoe"
                />
                {errors.linkedin_url && (
                  <p className="text-sm text-destructive">{errors.linkedin_url.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume_url">Resume URL</Label>
                <Input
                  id="resume_url"
                  {...register('resume_url')}
                  placeholder="https://example.com/resume.pdf"
                />
                {errors.resume_url && (
                  <p className="text-sm text-destructive">{errors.resume_url.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Skills</h3>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add a skill (e.g., React, Python, etc.)"
                  className="flex-1"
                />
                <Button type="button" onClick={addSkill} variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant={getSkillColor(skill)} className="flex items-center gap-1">
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="ml-1 rounded-full hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Profile Summary */}
          <div className="space-y-2">
            <Label htmlFor="profile_summary">Profile Summary</Label>
            <Textarea
              id="profile_summary"
              {...register('profile_summary')}
              placeholder="Brief summary of the candidate's background and experience..."
              rows={3}
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select value={source} onValueChange={(value) => setValue('source', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct Application</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="job_board">Job Board</SelectItem>
                <SelectItem value="recruiter">Recruiter</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (initialData ? 'Update Candidate' : 'Add Candidate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}