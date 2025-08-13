import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Sparkles, Loader2 } from 'lucide-react'
import { CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { getSkillColor } from '@/utils/skillColors'
import { SkillsGenerationPanel } from './SkillsGenerationPanel'
import { useResumeParsing } from '@/hooks/useResumeParsing'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { markdownToHtml } from '@/utils/markdown'

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
  const [dragOver, setDragOver] = useState(false)

  const [profileSummary, setProfileSummary] = useState(sanitizeHtmlForEditor(initialData?.profile_summary || ""))

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
  const { isParsing, parseResume } = useResumeParsing()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        profile_summary: profileSummary?.trim() ? sanitizeHtmlForEditor(profileSummary) : null,
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
            <h3 className="text-sm font-semibold text-foreground">Resume</h3>
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? 'border-pastel-purple bg-pastel-purple/15' : 'border-pastel-purple/70 hover:border-pastel-purple bg-pastel-purple/10'}`}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (!f) return; parseResume(f).then((parsed) => { if (!parsed) return; if (parsed.name) setValue('candidate_name', parsed.name); if (parsed.email) setValue('email', parsed.email); if (parsed.phone) setValue('phone', parsed.phone); if (parsed.profileSummary && parsed.profileSummary.trim().length > 0) { const sanitized = sanitizeHtmlForEditor(parsed.profileSummary); setValue('profile_summary', sanitized); } toast({ title: 'Parsed from resume', description: 'Prefilled basic info. Please review before saving.' }); }); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            >
              {isParsing && (
                <div className="absolute left-0 right-0 top-0 h-1 bg-pastel-purple animate-pulse rounded-t-lg" />
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.rtf"
                onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const parsed = await parseResume(f); if (parsed) { if (parsed.name) setValue('candidate_name', parsed.name); if (parsed.email) setValue('email', parsed.email); if (parsed.phone) setValue('phone', parsed.phone); if (parsed.profileSummary && parsed.profileSummary.trim().length > 0) { const sanitized = sanitizeHtmlForEditor(parsed.profileSummary); setValue('profile_summary', sanitized); } toast({ title: 'Parsed from resume', description: 'Prefilled basic info. Please review before saving.' }); } e.currentTarget.value = ''; }}
              />
              <Sparkles className="h-8 w-8 mx-auto text-pastel-purple-foreground mb-2" />
              <p className="text-sm text-text-secondary mb-2">Drag and drop here, and watch some magic</p>
              <p className="text-xs text-text-secondary mb-4">PDF, DOC, DOCX, TXT up to 15MB</p>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isParsing} className="gap-sm">
                {isParsing ? (<><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</>) : (<><Sparkles className="h-4 w-4" /> Choose File</>)}
              </Button>
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

          {/* AI Skills Generation */}
          <SkillsGenerationPanel
            profileSummary={watch("profile_summary") || ""}
            candidateName={watch("candidate_name") || ""}
            onSkillsAccepted={(newSkills) => {
              const uniqueSkills = [...new Set([...skills, ...newSkills])];
              setSkills(uniqueSkills);
            }}
            existingSkills={skills}
          />

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