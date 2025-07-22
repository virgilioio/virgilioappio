
import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { FormField } from '@/components/ui/form-field'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, ChevronsUpDown, X, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CURRENCIES } from '@/constants/currencies'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { CandidateComments } from './CandidateComments'
import type { Candidate } from '@/hooks/useCandidates'
import { toast } from '@/hooks/use-toast'
import { getSkillColor } from '@/utils/skillColors'
import { SkillsGenerationPanel } from './SkillsGenerationPanel'

interface CandidateFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  candidate?: Candidate | null
  jobId: string
  isLoading: boolean
}

interface FormData {
  candidate_name: string
  location_country: string
  location_state: string
  location_city: string
  salary_amount: string
  salary_currency: string
  salary_period: string
  profile_summary: string
  notes: string
  linkedin_url: string
}


export function CandidateForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  candidate, 
  jobId, 
  isLoading 
}: CandidateFormProps) {
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [profileSummary, setProfileSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [currentCandidateId, setCurrentCandidateId] = useState<string | null>(null)
  const { user } = useAuth()

  const form = useForm<FormData>({
    defaultValues: {
      candidate_name: '',
      location_country: '',
      location_state: '',
      location_city: '',
      salary_amount: '',
      salary_currency: 'USD',
      salary_period: 'annually',
      profile_summary: '',
      notes: '',
      linkedin_url: ''
    }
  })

  // Setup form persistence - only enable for new candidates (not editing existing ones)
  const { clearPersistedData } = useFormPersistence({
    storageKey: `candidate-form-${jobId}`,
    form,
    enabled: isOpen && !candidate, // Only persist for new candidates
    debounceMs: 300
  })

  // Effect for handling candidate data loading (when editing)
  useEffect(() => {
    if (candidate && isOpen) {
      // Check if this is a different candidate than the one currently loaded
      const candidateChanged = currentCandidateId !== candidate.id
      
      console.log('CandidateForm - Candidate data loading:', {
        candidateName: candidate.candidate_name,
        candidateId: candidate.id,
        currentCandidateId: currentCandidateId,
        candidateChanged: candidateChanged,
        isOpen: isOpen
      })
      
      // Always update the form if the candidate changed or if it's the first load
      if (candidateChanged || currentCandidateId === null) {
        console.log('CandidateForm - Updating form with candidate data')
        
        // Update the current candidate ID tracker
        setCurrentCandidateId(candidate.id)
        
        // Reset form with candidate data when editing
        const candidateData = {
          candidate_name: candidate.candidate_name || '',
          location_country: candidate.location_country || '',
          location_state: candidate.location_state || '',
          location_city: candidate.location_city || '',
          salary_amount: candidate.salary_amount?.toString() || '',
          salary_currency: candidate.salary_currency || 'USD',
          salary_period: candidate.salary_period || 'annually',
          profile_summary: candidate.profile_summary || '',
          notes: candidate.notes || '',
          linkedin_url: candidate.linkedin_url || ''
        }
        
        form.reset(candidateData)
        
        // Set the rich text editor values separately with logging
        const profileSummaryValue = candidate.profile_summary || ''
        const notesValue = candidate.notes || ''
        const skillsValue = candidate.skills || []
        
        console.log('CandidateForm - Setting rich text values:', {
          profileSummary: profileSummaryValue,
          notes: notesValue,
          skills: skillsValue
        })
        
        setProfileSummary(profileSummaryValue)
        setNotes(notesValue)
        setSkills(skillsValue)
      }
    } else if (!candidate && isOpen) {
      // Clear the current candidate ID when creating a new candidate
      setCurrentCandidateId(null)
    }
  }, [candidate, isOpen, form])

  // Effect for handling form reset (when closing dialog for new candidates)
  useEffect(() => {
    if (!isOpen) {
      console.log('CandidateForm - Dialog closed, resetting state')
      
      // Reset the current candidate ID tracking when dialog closes
      setCurrentCandidateId(null)
      
      // Only reset form when dialog closes for new candidates (not when editing)
      if (!candidate) {
        console.log('CandidateForm - Resetting form for new candidate creation')
        
        form.reset({
          candidate_name: '',
          location_country: '',
          location_state: '',
          location_city: '',
          salary_amount: '',
          salary_currency: 'USD',
          salary_period: 'annually',
          profile_summary: '',
          notes: '',
          linkedin_url: ''
        })
        
        // Reset rich text editor values only for new candidates
        setProfileSummary('')
        setNotes('')
        setSkills([])
        setNewSkill('')
      }
    }
  }, [isOpen, candidate, form])

  const validateLinkedInUrl = (url: string) => {
    if (!url) return true // Allow empty URLs
    
    const linkedinRegex = /^https?:\/\/.*linkedin\.com/
    return linkedinRegex.test(url) || 'Please enter a valid LinkedIn URL'
  }

  const handleSubmit = form.handleSubmit((data) => {
    const submitData = {
      ...data,
      salary_amount: data.salary_amount ? Number(data.salary_amount) : null,
      profile_summary: profileSummary,
      notes: notes,
      skills: skills.length > 0 ? skills : null,
      job_id: jobId
    }
    
    onSubmit(submitData)
    
    // Clear persisted data after successful submission
    if (!candidate) {
      clearPersistedData()
    }
  })

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


  const handleClose = () => {
    console.log('CandidateForm - Closing form:', {
      candidate: candidate?.candidate_name,
      currentCandidateId: currentCandidateId,
      isEditing: !!candidate
    })
    
    // Reset the current candidate ID when closing
    if (candidate) {
      setCurrentCandidateId(null)
    }
    
    // Don't clear persisted data when closing - let it persist for later use
    onClose()
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-primary">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-xl font-semibold text-text-primary">
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Candidate Form */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Basic Information
              </h3>
              
              <FormField 
                label="Name or Alias" 
                required 
                error={form.formState.errors.candidate_name?.message}
                htmlFor="candidate_name"
              >
                <Input
                  id="candidate_name"
                  {...form.register('candidate_name', { required: 'Name is required' })}
                  placeholder="Enter candidate name or alias"
                  className="h-[44px]"
                />
              </FormField>

              <FormField 
                label="LinkedIn Profile URL" 
                error={form.formState.errors.linkedin_url?.message}
                htmlFor="linkedin_url"
                helpText="Optional - Enter the candidate's LinkedIn profile URL"
              >
                <Input
                  id="linkedin_url"
                  {...form.register('linkedin_url', { 
                    validate: validateLinkedInUrl 
                  })}
                  placeholder="https://linkedin.com/in/username"
                  className="h-[44px]"
                />
              </FormField>
            </div>

            {/* Location Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Location
              </h3>
              
              <FormField 
                label="Country"
                htmlFor="location_country"
              >
                <Input
                  id="location_country"
                  {...form.register('location_country')}
                  placeholder="Country"
                  className="h-[44px]"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="State/Province"
                  htmlFor="location_state"
                >
                  <Input
                    id="location_state"
                    {...form.register('location_state')}
                    placeholder="State/Province"
                    className="h-[44px]"
                  />
                </FormField>

                <FormField 
                  label="City"
                  htmlFor="location_city"
                >
                  <Input
                    id="location_city"
                    {...form.register('location_city')}
                    placeholder="City"
                    className="h-[44px]"
                  />
                </FormField>
              </div>
            </div>

            {/* Salary Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Salary Expectations
              </h3>
              
              <FormField 
                label="Amount"
                error={form.formState.errors.salary_amount?.message}
                htmlFor="salary_amount"
              >
                <Input
                  id="salary_amount"
                  type="number"
                  {...form.register('salary_amount', {
                    validate: (value) => {
                      if (value && isNaN(Number(value))) return 'Please enter a valid number'
                      if (value && Number(value) <= 0) return 'Salary must be greater than 0'
                      return true
                    }
                  })}
                  placeholder="50000"
                  className="h-[44px]"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="Currency"
                  htmlFor="salary_currency"
                >
                  <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={currencyOpen}
                        className="w-full justify-between h-[44px]"
                      >
                        {form.watch('salary_currency')
                          ? CURRENCIES.find((currency) => currency.value === form.watch('salary_currency'))?.label
                          : "Select currency..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search currency..." />
                        <CommandList>
                          <CommandEmpty>No currency found.</CommandEmpty>
                          <CommandGroup>
                            {CURRENCIES.map((currency) => (
                              <CommandItem
                                key={currency.value}
                                value={currency.value}
                                onSelect={(currentValue) => {
                                  form.setValue('salary_currency', currentValue.toUpperCase())
                                  setCurrencyOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.watch('salary_currency') === currency.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {currency.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FormField>

                <FormField 
                  label="Period"
                  htmlFor="salary_period"
                >
                  <Select 
                    value={form.watch('salary_period')} 
                    onValueChange={(value) => form.setValue('salary_period', value)}
                  >
                    <SelectTrigger className="h-[44px]">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>

            {/* Skills */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Skills & Expertise
              </h3>
              
              <FormField 
                label="Skills" 
                htmlFor="skills"
                helpText="Add relevant skills and technologies"
              >
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add a skill (e.g., React, Python, etc.)"
                      className="flex-1 h-[44px]"
                    />
                    <Button type="button" onClick={addSkill} variant="outline" size="sm" className="h-[44px]">
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
              </FormField>
            </div>

            {/* AI Skills Generation */}
            <SkillsGenerationPanel
              profileSummary={profileSummary}
              candidateName={form.watch('candidate_name')}
              onSkillsAccepted={(newSkills) => {
                const uniqueSkills = [...new Set([...skills, ...newSkills])];
                setSkills(uniqueSkills);
              }}
              existingSkills={skills}
            />

            {/* Profile & Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Additional Information
              </h3>
              
              <FormField 
                label="Profile Summary" 
                htmlFor="profile_summary"
                helpText="Brief overview of candidate's experience and skills"
              >
                <RichTextEditor
                  value={profileSummary}
                  onChange={setProfileSummary}
                  placeholder="Brief summary of candidate's background, experience, and key skills..."
                  minHeight="150px"
                  className="mt-1"
                />
              </FormField>

              <FormField 
                label="Internal Notes" 
                htmlFor="notes"
                helpText="Private notes visible only to internal team"
              >
                <RichTextEditor
                  value={notes}
                  onChange={setNotes}
                  placeholder="Add any additional internal notes about this candidate..."
                  minHeight="120px"
                  className="mt-1"
                />
              </FormField>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
              <Button 
                type="submit" 
                disabled={isLoading} 
                className="flex-1 h-[44px]"
              >
                {isLoading ? 'Saving...' : candidate ? 'Update Candidate' : 'Add Candidate'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                className="h-[44px] sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </form>

          {/* Comments Section - Only show for existing candidates */}
          {candidate && (
            <>
              <Separator className="my-6" />
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                  Comments & Discussion
                </h3>
                <div className="bg-surface-secondary rounded-lg p-6">
                  <CandidateComments
                    candidateId={candidate.id}
                    jobId={candidate.job_id}
                    organizationId={user.user_metadata?.organization_id || 'default-org'}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
