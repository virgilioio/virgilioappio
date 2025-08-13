
import React, { useState, useEffect, useRef } from 'react'
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
import { Check, ChevronsUpDown, X, Plus, Sparkles, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CURRENCIES } from '@/constants/currencies'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { CandidateComments } from './CandidateComments'
import type { Candidate } from '@/hooks/useCandidates'
import { toast } from '@/hooks/use-toast'
import { getSkillColor } from '@/utils/skillColors'
import { SkillsGenerationPanel } from './SkillsGenerationPanel'
import { useResumeParsing } from '@/hooks/useResumeParsing'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'

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
  email: string
  phone: string
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
  const [profileIsExternalUpdate, setProfileIsExternalUpdate] = useState(false)
  const [notes, setNotes] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [currentCandidateId, setCurrentCandidateId] = useState<string | null>(null)
  const { user, organizationId } = useAuth()
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isUploadingResume, setIsUploadingResume] = useState(false)
  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  const { isParsing, parseResume } = useResumeParsing();

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
      linkedin_url: '',
      email: '',
      phone: ''
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
        
        const sanitizedProfile = sanitizeHtmlForEditor(profileSummaryValue)
        setProfileSummary(sanitizedProfile)
        setProfileIsExternalUpdate(true)
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
          linkedin_url: '',
          email: '',
          phone: ''
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

  // Resume upload helpers
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)

    // Validate file sizes (15MB max per file)
    for (const f of fileArray) {
      if (f.size > 15 * 1024 * 1024) {
        toast({ title: 'Error', description: 'File size must be less than 15MB', variant: 'destructive' })
        return
      }
    }

    if (candidate?.id) {
      // Editing existing candidate: upload immediately
      try {
        setIsUploadingResume(true)
        for (const f of fileArray) {
          await uploadFileForCandidate(candidate.id, f)
        }
        toast({ title: 'Resume uploaded', description: 'Attachment added to candidate.' })
      } catch (e) {
        // errors already toasted below
      } finally {
        setIsUploadingResume(false)
      }
    } else {
      // New candidate: queue files to upload after creation
      setPendingFiles((prev) => [...prev, ...fileArray])

      try {
        const first = fileArray[0]
        if (first) {
          const parsed = await parseResume(first)
          if (parsed) {
            if (parsed.name) form.setValue('candidate_name', parsed.name)
            if (parsed.email) form.setValue('email', parsed.email)
            if (parsed.phone) form.setValue('phone', parsed.phone)
            if (parsed.profileSummary && parsed.profileSummary.trim().length > 0) {
              setProfileSummary(parsed.profileSummary)
            }
            toast({ title: 'Parsed from resume', description: 'Prefilled basic info. Please review before saving.' })
          }
        }
      } catch (_) {
        // Errors are handled in the parsing hook
      }

    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileSelect(e.target.files)
    e.currentTarget.value = ''
  }

  const removePendingFile = (name: string, size: number) => {
    setPendingFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)))
  }

  const uploadFileForCandidate = async (jobCandidateId: string, file: File) => {
    if (!user) throw new Error('Not authenticated')
    try {
      const ext = file.name.split('.').pop()
      const storagePath = `${jobCandidateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: storageError } = await supabase.storage
        .from('candidate-attachments')
        .upload(storagePath, file)
      if (storageError) throw storageError

      const { error: dbError } = await supabase
        .from('candidate_attachments')
        .insert({
          candidate_id: jobCandidateId,
          file_name: file.name,
          file_url: storagePath,
          file_size_bytes: file.size,
          file_type: file.type,
          uploaded_by: user.id,
        })
      if (dbError) {
        await supabase.storage.from('candidate-attachments').remove([storagePath])
        throw dbError
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload resume'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
      throw err
    }
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    const submitData = {
      ...data,
      email: data.email?.trim() ? data.email.trim() : null,
      phone: data.phone?.trim() ? data.phone.trim() : null,
      salary_amount: data.salary_amount ? Number(data.salary_amount) : null,
      profile_summary: profileSummary,
      notes: notes,
      skills: skills.length > 0 ? skills : null,
      job_id: jobId
    }

    const result = await onSubmit(submitData as any)

    // After create, upload any queued files
    if (!candidate) {
      if (pendingFiles.length > 0 && (result as any)?.id) {
        try {
          setIsUploadingResume(true)
          for (const f of pendingFiles) {
            await uploadFileForCandidate((result as any).id, f)
          }
          toast({ title: 'Resume uploaded', description: 'Attachment added to candidate.' })
          setPendingFiles([])
        } finally {
          setIsUploadingResume(false)
        }
      }
      // Clear persisted data after successful submission
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

            {/* Resume Upload */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Resume
              </h3>
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? 'border-pastel-purple bg-pastel-purple/15' : 'border-pastel-purple/70 hover:border-pastel-purple bg-pastel-purple/10'}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {isParsing && (
                  <div className="absolute left-0 right-0 top-0 h-1 bg-pastel-purple animate-pulse rounded-t-lg" />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept=".pdf,.doc,.docx,.txt,.rtf"
                />
                <Sparkles className="h-8 w-8 mx-auto text-pastel-purple-foreground mb-2" />
                <p className="text-sm text-text-secondary mb-2">Drag and drop here, and watch some magic</p>
                <p className="text-xs text-text-secondary mb-4">PDF, DOC, DOCX, TXT up to 15MB</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingResume || isParsing}
                  className="gap-sm"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Parsing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Choose File
                    </>
                  )}
                </Button>
              </div>

              {!candidate && pendingFiles.length > 0 && (
                <div className="mt-2 text-left space-y-2">
                  {pendingFiles.map((f) => (
                    <div key={f.name + f.size} className="flex items-center justify-between p-2 border border-border rounded-md">
                      <span className="text-sm text-text-primary truncate mr-2">{f.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePendingFile(f.name, f.size)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                />
              </FormField>

                  <FormField 
                    label="Email" 
                    htmlFor="email"
                    helpText="Optional"
                  >
                    <Input
                      id="email"
                      type="email"
                      {...form.register('email')}
                      placeholder="john@example.com"
                    />
                  </FormField>

                  <FormField 
                    label="Phone" 
                    htmlFor="phone"
                    helpText="Optional"
                  >
                    <Input
                      id="phone"
                      {...form.register('phone')}
                      placeholder="+1 (555) 123-4567"
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
                        className="w-full justify-between"
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
                    <SelectTrigger>
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
                  isExternalUpdate={profileIsExternalUpdate}
                  onExternalUpdateComplete={() => setProfileIsExternalUpdate(false)}
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
                className="flex-1"
              >
                {isLoading ? 'Saving...' : candidate ? 'Update Candidate' : 'Add Candidate'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                className="sm:w-auto"
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
                    organizationId={organizationId || 'default-org'}
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
