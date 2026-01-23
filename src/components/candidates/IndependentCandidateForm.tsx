import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { X, Plus } from 'lucide-react'
import { CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
import { getSkillColor } from '@/utils/skillColors'
import { SkillsGenerationPanel } from './SkillsGenerationPanel'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { markdownToHtml } from '@/utils/markdown'
import { EnhancedResumeDropzone, ParsedResumeData } from './EnhancedResumeDropzone'
import { ContactEmailsInput, ContactEmail } from './ContactEmailsInput'
import { ContactPhonesInput, ContactPhone } from './ContactPhonesInput'
import { parseContactEntry } from '@/utils/parseContactEntry'
import { triggerBackgroundEnrichment } from '@/hooks/useCandidateEnrichment'
import { BackgroundEnrichmentBanner } from './BackgroundEnrichmentBanner'

const candidateSchema = z.object({
  candidate_name: z.string().min(1, 'Name is required'),
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
  onSubmit: (data: CreateIndependentCandidateData) => Promise<{ id: string } | void>
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
  const [capturedResumeText, setCapturedResumeText] = useState<string>('')
  const [showEnrichmentBanner, setShowEnrichmentBanner] = useState(false)

  // Initialize contact emails from initialData or create one empty entry
  const [contactEmails, setContactEmails] = useState<ContactEmail[]>(() => {
    if (initialData?.contact_emails && Array.isArray(initialData.contact_emails) && initialData.contact_emails.length > 0) {
      return initialData.contact_emails.map(e => {
        const parsed = parseContactEntry(e)
        return {
          type: (parsed?.type as 'work' | 'personal' | 'other') || 'work',
          email: parsed?.email || '',
          status: parsed?.status || null
        }
      }).filter(e => e.email)
    }
    // Fallback to single email field
    if (initialData?.email) {
      return [{ type: 'work' as const, email: initialData.email, status: null }]
    }
    return [{ type: 'work' as const, email: '', status: null }]
  })

  // Initialize contact phones from initialData or create one empty entry
  const [contactPhones, setContactPhones] = useState<ContactPhone[]>(() => {
    if (initialData?.contact_phones && Array.isArray(initialData.contact_phones) && initialData.contact_phones.length > 0) {
      return initialData.contact_phones.map(p => {
        const parsed = parseContactEntry(p)
        return {
          type: (parsed?.type as 'work' | 'mobile' | 'other') || 'mobile',
          number: parsed?.number || '',
          raw_number: parsed?.raw_number || null
        }
      }).filter(p => p.number)
    }
    // Fallback to single phone field
    if (initialData?.phone) {
      return [{ type: 'mobile' as const, number: initialData.phone, raw_number: null }]
    }
    return [{ type: 'mobile' as const, number: '', raw_number: null }]
  })

  const [profileSummary, setProfileSummary] = useState(() => sanitizeHtmlForEditor(markdownToHtml(initialData?.profile_summary || "")))

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
      // Filter out empty emails and phones
      const validEmails = contactEmails.filter(e => e.email.trim())
      const validPhones = contactPhones.filter(p => p.number.trim())
      
      const formattedData: CreateIndependentCandidateData = {
        candidate_name: data.candidate_name,
        // Set primary email/phone from first entry for backward compatibility
        email: validEmails[0]?.email || null,
        phone: validPhones[0]?.number || null,
        // Include full arrays
        contact_emails: validEmails.length > 0 ? validEmails : null,
        contact_phones: validPhones.length > 0 ? validPhones : null,
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

      const result = await onSubmit(formattedData)
      
      // Trigger background AI enrichment if we have resume text and got a candidate ID back
      const candidateId = result && typeof result === 'object' && 'id' in result ? result.id : null
      if (candidateId && capturedResumeText) {
        console.log('🧠 Triggering background AI enrichment for independent candidate:', candidateId)
        triggerBackgroundEnrichment(
          candidateId,
          capturedResumeText,
          data.candidate_name
        )
        setCapturedResumeText('') // Clear after triggering
      }
      
      handleCancel()
    } catch (error) {
      console.error('Error submitting candidate form:', error)
    }
  }

  // Handler for clicking outside / dismiss - preserve data
  const handleDismiss = (open: boolean) => {
    if (!open) {
      console.log('IndependentCandidateForm - Dismissed (clicking outside), preserving data')
      onClose()
    }
  }

  // Handler for Cancel button - clear all fields
  const handleCancel = () => {
    console.log('IndependentCandidateForm - Cancel clicked, clearing form')
    reset()
    setSkills([])
    setNewSkill('')
    setContactEmails([{ type: 'work', email: '', status: null }])
    setContactPhones([{ type: 'mobile', number: '', raw_number: null }])
    setProfileSummary('')
    setCapturedResumeText('')
    setShowEnrichmentBanner(false)
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
    <Dialog open={isOpen} onOpenChange={handleDismiss}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {initialData ? 'Update candidate information' : 'Add a new candidate to your talent database'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <form id="candidate-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Resume</h3>
            <EnhancedResumeDropzone
              onParsed={(parsed: ParsedResumeData) => {
                console.log('[IndependentCandidateForm] ===== onParsed CALLBACK INVOKED =====');
                console.log('[IndependentCandidateForm] Received parsed data:', {
                  name: parsed.name,
                  email: parsed.email,
                  phone: parsed.phone,
                  linkedinUrl: parsed.linkedinUrl,
                  location: parsed.location,
                  profileSummary: parsed.profileSummary ? '(exists)' : '(missing)'
                });
                
                // Apply parsed data to form
                if (parsed.name) setValue('candidate_name', parsed.name)
                if (parsed.email) {
                  setContactEmails([{ type: 'work', email: parsed.email, status: null }])
                }
                if (parsed.phone) {
                  setContactPhones([{ type: 'mobile', number: parsed.phone, raw_number: null }])
                }
                
                if (parsed.linkedinUrl) {
                  console.log('[IndependentCandidateForm] Setting linkedin_url:', parsed.linkedinUrl);
                  setValue('linkedin_url', parsed.linkedinUrl)
                } else {
                  console.log('[IndependentCandidateForm] WARNING: No linkedinUrl in parsed data');
                }
                
                // Parse location string into separate fields
                if (parsed.location) {
                  console.log('[IndependentCandidateForm] Parsing location:', parsed.location);
                  const parts = parsed.location.split(',').map(s => s.trim())
                  console.log('[IndependentCandidateForm] Split into parts:', parts);
                  
                  if (parts.length === 3) {
                    console.log('[IndependentCandidateForm] Setting location fields:', {
                      city: parts[0],
                      state: parts[1],
                      country: parts[2]
                    });
                    setValue('location_city', parts[0])
                    setValue('location_state', parts[1])
                    setValue('location_country', parts[2])
                  } else if (parts.length === 2) {
                    console.log('[IndependentCandidateForm] Setting location fields (2 parts):', {
                      city: parts[0],
                      country: parts[1]
                    });
                    setValue('location_city', parts[0])
                    setValue('location_country', parts[1])
                  } else {
                    console.log('[IndependentCandidateForm] WARNING: Unexpected location format, parts:', parts);
                  }
                } else {
                  console.log('[IndependentCandidateForm] WARNING: No location in parsed data');
                }
                
                // For quick parse mode, profileSummary may be empty - that's fine, AI enrichment will fill it
                if (parsed.profileSummary && parsed.profileSummary.trim().length > 0) {
                  const html = markdownToHtml(parsed.profileSummary)
                  const sanitized = sanitizeHtmlForEditor(html)
                  setProfileSummary(sanitized)
                  setValue('profile_summary', sanitized)
                }
              }}
              onSkillsGenerated={(newSkills: string[]) => {
                const uniqueSkills = [...new Set([...skills, ...newSkills])]
                setSkills(uniqueSkills)
              }}
              candidateName={watch('candidate_name')}
              autoGenerateSkills={false} // Disable - will be done in background enrichment
              parseOnly={true}
              useTwoStageAI={true} // Use fast AI core extraction for new candidates
              onResumeTextCaptured={(text) => {
                setCapturedResumeText(text)
                setShowEnrichmentBanner(true)
              }}
              accept=".pdf,.doc,.docx,.txt,.rtf"
              maxSizeMb={15}
            />
            
            {/* Background Enrichment Banner */}
            {showEnrichmentBanner && capturedResumeText && (
              <BackgroundEnrichmentBanner 
                isVisible={true}
                onDismiss={() => setShowEnrichmentBanner(false)}
              />
            )}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select value={source} onValueChange={(value) => setValue('source', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct / Internal</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="sourced">Sourced by Recruiter</SelectItem>
                    <SelectItem value="headhunter">Headhunter</SelectItem>
                    <SelectItem value="job_board">Job Board</SelectItem>
                    <SelectItem value="career_fair">Career Fair</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ContactEmailsInput
                value={contactEmails}
                onChange={setContactEmails}
              />
              <ContactPhonesInput
                value={contactPhones}
                onChange={setContactPhones}
              />
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
            profileSummary={profileSummary}
            onSkillsAccepted={(newSkills) => {
              const uniqueSkills = [...new Set([...skills, ...newSkills])];
              setSkills(uniqueSkills);
            }}
            existingSkills={skills}
          />

          {/* Profile Summary */}
          <div className="space-y-2">
            <Label htmlFor="profile_summary">Profile Summary</Label>
            <RichTextEditor
              value={profileSummary}
              onChange={setProfileSummary}
              placeholder="Brief summary of the candidate's background and experience..."
              minHeight="150px"
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

          </form>
        </div>

        <DialogFooter className="border-t pt-4 mt-4 bg-background">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" form="candidate-form" disabled={isLoading}>
            {isLoading ? 'Saving...' : (initialData ? 'Update Candidate' : 'Add Candidate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}