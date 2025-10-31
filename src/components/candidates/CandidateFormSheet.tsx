import React, { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { FormField } from '@/components/ui/form-field'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, ChevronsUpDown, X, Plus, Sparkles, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CURRENCIES } from '@/constants/currencies'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import { CandidateComments } from './CandidateComments'
import type { Candidate } from '@/hooks/useCandidates'
import { toast } from '@/hooks/use-toast'
import { getSkillColor } from '@/utils/skillColors'
import { SkillsGenerationPanel } from './SkillsGenerationPanel'
import { useResumeParsing } from '@/hooks/useResumeParsing'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { markdownToHtml } from '@/utils/markdown'
import { ParsingAnimation } from '@/components/ui/parsing-animation'
import { useSkillsGeneration } from '@/hooks/useSkillsGeneration'
import { EnhancedResumeDropzone, ParsedResumeData } from './EnhancedResumeDropzone'
import { useJobsForCandidateAssignment } from '@/hooks/useJobsForCandidateAssignment'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CandidateMergeDialog } from './CandidateMergeDialog'

interface CandidateFormSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<any> | void
  candidate?: Candidate | null
  jobId?: string // Made optional for global candidate creation
  stageId?: string // Optional pre-selected stage
  preSelectedJob?: { id: string; title: string; locked: boolean } // For job detail context
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

export function CandidateFormSheet({ 
  isOpen, 
  onClose, 
  onSubmit, 
  candidate, 
  jobId,
  stageId,
  preSelectedJob,
  isLoading 
}: CandidateFormSheetProps) {
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
  
  // Job assignment state (only for create mode)
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  
  // Hooks for job assignment
  const { jobs: availableJobs, isLoading: isLoadingJobs } = useJobsForCandidateAssignment()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const [jobStages, setJobStages] = useState<Array<{ jhsId: string; stage: any; position: number }>>([])
  const [isLoadingStages, setIsLoadingStages] = useState(false)
  
  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  const { isParsing, parseResume } = useResumeParsing();
  const { generateSkills, isGenerating } = useSkillsGeneration();
  
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeData, setMergeData] = useState<{
    existing: any
    incoming: any
    merged: any
  } | null>(null)
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null)

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
      
      console.log('CandidateFormSheet - Candidate data loading:', {
        candidateName: candidate.candidate_name,
        candidateId: candidate.id,
        currentCandidateId: currentCandidateId,
        candidateChanged: candidateChanged,
        isOpen: isOpen
      })
      
      // Always update the form if the candidate changed or if it's the first load
      if (candidateChanged || currentCandidateId === null) {
        console.log('CandidateFormSheet - Updating form with candidate data')
        
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
          linkedin_url: candidate.linkedin_url || '',
          email: candidate.email || '',
          phone: candidate.phone || ''
        }
        
        form.reset(candidateData)
        
        // Set the rich text editor values separately with logging
        const profileSummaryValue = candidate.profile_summary || ''
        const notesValue = candidate.notes || ''
        const skillsValue = candidate.skills || []
        
        console.log('CandidateFormSheet - Setting rich text values:', {
          profileSummary: profileSummaryValue,
          notes: notesValue,
          skills: skillsValue
        })
        
        const sanitizedProfile = sanitizeHtmlForEditor(markdownToHtml(profileSummaryValue))
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

  // Effect for handling pre-selected job and initial state
  useEffect(() => {
    if (isOpen && !candidate) {
      // Reset job assignment state when opening for new candidate
      if (preSelectedJob) {
        setSelectedJobId(preSelectedJob.id)
        // Load stages for pre-selected job
        loadStagesForJob(preSelectedJob.id)
        // Pre-select stage if provided
        if (stageId) {
          setSelectedStageId(stageId)
        }
      } else {
        setSelectedJobId(jobId || '')
        setSelectedStageId(stageId || '')
        if (jobId) {
          loadStagesForJob(jobId)
        }
      }
    }
  }, [isOpen, candidate, preSelectedJob, jobId, stageId])

  // Function to load stages for selected job
  const loadStagesForJob = async (jobIdToLoad: string) => {
    if (!jobIdToLoad) {
      setJobStages([])
      return
    }

    setIsLoadingStages(true)
    try {
      const stages = await loadHiringPlanInstances(jobIdToLoad)
      setJobStages(stages)
    } catch (error) {
      console.error('Error loading stages:', error)
      setJobStages([])
    } finally {
      setIsLoadingStages(false)
    }
  }

  // Handle job selection change
  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId)
    setSelectedStageId('') // Reset stage when job changes
    if (jobId) {
      loadStagesForJob(jobId)
    } else {
      setJobStages([])
    }
  }

  // Effect for handling form reset (when closing dialog for new candidates)
  useEffect(() => {
    if (!isOpen) {
      console.log('CandidateFormSheet - Sheet closed, resetting state')
      
      // Reset the current candidate ID tracking when dialog closes
      setCurrentCandidateId(null)
      
      // Only reset form when dialog closes for new candidates (not when editing)
      if (!candidate) {
        console.log('CandidateFormSheet - Resetting form for new candidate creation')
        
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
        
        // Reset job assignment state
        setSelectedJobId('')
        setSelectedStageId('')
        setJobStages([])
      }
    }
  }, [isOpen, candidate, form])

  const validateLinkedInUrl = (url: string) => {
    if (!url) return true // Allow empty URLs
    
    // Accept linkedin.com URLs with or without protocol
    const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com/i
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

      // Use enhanced dropzone for parsing when creating new candidates
      const first = fileArray[0]
      if (first) {
        // Enhanced dropzone will handle parsing and skills generation
      }
    }
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

  const handlePostSubmitActions = async (result: any) => {
    console.log('📎 handlePostSubmitActions called', { result, pendingFilesCount: pendingFiles.length, isNewCandidate: !candidate })
    
    if (!candidate) {
      const candidateId = result?.id
      console.log('📎 Candidate ID from result:', candidateId)
      
      if (pendingFiles.length > 0 && candidateId) {
        try {
          setIsUploadingResume(true)
          console.log('📎 Uploading pending files:', pendingFiles.length)
          
          for (const f of pendingFiles) {
            console.log('📎 Uploading file:', f.name)
            await uploadFileForCandidate(candidateId, f)
          }
          
          toast({ title: 'Resume uploaded', description: 'Attachment added to candidate.' })
          setPendingFiles([])
          console.log('📎 All files uploaded successfully')
        } catch (error) {
          console.error('📎 Error uploading files:', error)
        } finally {
          setIsUploadingResume(false)
        }
      } else {
        console.log('📎 Skipping file upload:', { hasPendingFiles: pendingFiles.length > 0, hasCandidateId: !!candidateId })
      }
      clearPersistedData()
    }
  }

  const handleMergeConfirm = async () => {
    setMergeDialogOpen(false)
    
    toast({
      title: 'Candidate Merged',
      description: 'The candidate information has been merged and added to the job.',
    })
    
    // Complete post-submit actions
    if (pendingSubmitData) {
      await handlePostSubmitActions({ id: mergeData?.existing?.id })
    }
    
    setMergeData(null)
    setPendingSubmitData(null)
    onClose()
  }

  const handleMergeCancel = () => {
    setMergeDialogOpen(false)
    setMergeData(null)
    setPendingSubmitData(null)
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    // For new candidates without a job context, validate org/job selection
    if (!candidate && !jobId) {
      if (!selectedJobId && !organizationId) {
        toast({
          title: 'Selection Required',
          description: 'Select a job (or organization) before creating a candidate.',
          variant: 'destructive'
        })
        return
      }
    }
    
    // Normalize LinkedIn URL - add https:// if missing
    let normalizedLinkedInUrl = data.linkedin_url?.trim() || ''
    if (normalizedLinkedInUrl && !normalizedLinkedInUrl.match(/^https?:\/\//i)) {
      normalizedLinkedInUrl = `https://${normalizedLinkedInUrl}`
    }
    
    const submitData = {
      ...data,
      email: data.email?.trim() ? data.email.trim() : null,
      phone: data.phone?.trim() ? data.phone.trim() : null,
      linkedin_url: normalizedLinkedInUrl || null,
      salary_amount: data.salary_amount ? Number(data.salary_amount) : null,
      profile_summary: sanitizeHtmlForEditor(profileSummary),
      notes: notes,
      skills: skills.length > 0 ? skills : null,
      job_id: jobId,
      // Job assignment data for new candidates
      ...(!candidate && {
        assignedJobId: selectedJobId || null,
        assignedStageId: selectedStageId || null
      })
    }

    // Store for later if merge dialog appears
    setPendingSubmitData(submitData)

    const result = await onSubmit(submitData as any)
    console.log('📎 onSubmit result:', result)

    // Check if merge occurred
    if (result && (result as any).wasMerged) {
      console.log('📎 Merge detected, opening merge dialog')
      setMergeData({
        existing: (result as any).existingData,
        incoming: submitData,
        merged: (result as any).mergedData
      })
      setMergeDialogOpen(true)
      return // Don't proceed with file upload yet
    }

    // Normal flow for new candidates
    console.log('📎 Normal flow - calling handlePostSubmitActions')
    if (result) {
      await handlePostSubmitActions(result)
    } else {
      console.log('📎 No result returned from onSubmit')
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
    console.log('CandidateFormSheet - Closing form:', {
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
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-[540px] flex flex-col">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}<span className="text-purple-period">.</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-6">
            {/* Candidate Form */}
            <form id="candidate-form" onSubmit={handleSubmit} className="space-y-6">

            {/* Resume Upload */}
            <div className="space-y-4">
              <h3 className="text-base font-poppins font-bold text-virgilio-text tracking-page-title pb-2 border-b border-virgilio-border">
                Resume<span className="text-purple-period">.</span>
              </h3>
              <EnhancedResumeDropzone
                onUpload={candidate ? uploadFileForCandidate.bind(null, candidate.id) : undefined}
                onParsed={(parsed: ParsedResumeData) => {
                  console.log('[CandidateFormSheet] onParsed received:', parsed);
                  
                  // Apply parsed data to form
                  if (parsed.name) form.setValue('candidate_name', parsed.name)
                  if (parsed.email) form.setValue('email', parsed.email)
                  if (parsed.phone) form.setValue('phone', parsed.phone)
                  
                  // Add LinkedIn URL (with normalization)
                  if (parsed.linkedinUrl) {
                    let normalizedUrl = parsed.linkedinUrl.trim()
                    if (!normalizedUrl.match(/^https?:\/\//i)) {
                      normalizedUrl = `https://${normalizedUrl}`
                    }
                    console.log('[CandidateFormSheet] Setting linkedin_url:', normalizedUrl);
                    form.setValue('linkedin_url', normalizedUrl)
                  }
                  
                  // Add Location parsing
                  if (parsed.location) {
                    console.log('[CandidateFormSheet] Parsing location:', parsed.location);
                    const parts = parsed.location.split(',').map(s => s.trim())
                    console.log('[CandidateFormSheet] Location parts:', parts);
                    
                    if (parts.length === 3) {
                      form.setValue('location_city', parts[0])
                      form.setValue('location_state', parts[1])
                      form.setValue('location_country', parts[2])
                    } else if (parts.length === 2) {
                      form.setValue('location_city', parts[0])
                      form.setValue('location_country', parts[1])
                    }
                  }
                  
                  if (parsed.profileSummary) {
                    const html = sanitizeHtmlForEditor(
                      parsed.profileSummary.includes('<')
                        ? parsed.profileSummary
                        : markdownToHtml(parsed.profileSummary)
                    )
                    setProfileSummary(html)
                    setProfileIsExternalUpdate(true)
                  }
                }}
                onSkillsGenerated={(newSkills: string[]) => {
                  const uniqueSkills = [...new Set([...skills, ...newSkills])]
                  setSkills(uniqueSkills)
                }}
                isUploading={isUploadingResume}
                candidateId={candidate?.id}
                candidateName={form.watch('candidate_name')}
                autoGenerateSkills={true}
                showUpload={!!candidate} // Only upload for existing candidates
                parseOnly={!candidate} // For new candidates, just parse
              />

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
              <h3 className="text-base font-poppins font-bold text-virgilio-text tracking-page-title pb-2 border-b border-virgilio-border">
                Basic Information<span className="text-purple-period">.</span>
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
                  {...form.register('linkedin_url', { validate: validateLinkedInUrl })}
                  placeholder="https://linkedin.com/in/username"
                />
              </FormField>
            </div>

            {/* Job Assignment - Only show for new candidates */}
            {!candidate && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                  Assign to Job (Optional)
                </h3>
                
                <FormField 
                  label="Job" 
                  htmlFor="job_assignment"
                  helpText="Select a job to associate this candidate with"
                >
                  <SearchableSelect
                    options={availableJobs.map(job => ({ value: job.id, label: job.display_label }))}
                    value={selectedJobId}
                    onValueChange={handleJobChange}
                    placeholder={isLoadingJobs ? "Loading jobs..." : "Select a job..."}
                    searchPlaceholder="Search jobs..."
                    disabled={isLoadingJobs || (preSelectedJob?.locked ?? false)}
                  />
                </FormField>

                {selectedJobId && (
                  <FormField 
                    label="Stage" 
                    htmlFor="stage_assignment"
                    helpText="Select the hiring stage for this candidate"
                    required={!!selectedJobId}
                  >
                    <Select 
                      value={selectedStageId} 
                      onValueChange={setSelectedStageId}
                      disabled={isLoadingStages}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingStages ? "Loading stages..." : "Select a stage..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {jobStages.map((stageOption) => (
                          <SelectItem key={stageOption.jhsId} value={stageOption.jhsId}>
                            {stageOption.stage.stage_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}

                {availableJobs.length === 0 && !isLoadingJobs && (
                  <div className="text-sm text-text-secondary p-3 bg-background-secondary rounded-md">
                    No jobs available for assignment. Candidates will be added to the global candidate list.
                  </div>
                )}
              </div>
            )}

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Location
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Country" htmlFor="location_country" helpText="Optional">
                  <Input
                    id="location_country"
                    {...form.register('location_country')}
                    placeholder="United States"
                  />
                </FormField>

                <FormField label="State/Province" htmlFor="location_state" helpText="Optional">
                  <Input
                    id="location_state"
                    {...form.register('location_state')}
                    placeholder="California"
                  />
                </FormField>

                <FormField label="City" htmlFor="location_city" helpText="Optional">
                  <Input
                    id="location_city"
                    {...form.register('location_city')}
                    placeholder="San Francisco"
                  />
                </FormField>
              </div>
            </div>

            {/* Salary Expectations */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Salary Expectations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Amount" htmlFor="salary_amount" helpText="Optional">
                  <Input
                    id="salary_amount"
                    type="number"
                    {...form.register('salary_amount')}
                    placeholder="120000"
                  />
                </FormField>

                <FormField label="Currency" htmlFor="salary_currency">
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

                <FormField label="Period" htmlFor="salary_period">
                  <Select value={form.watch('salary_period')} onValueChange={(value) => form.setValue('salary_period', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
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
                Skills
              </h3>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Add a skill..."
                  />
                  <Button type="button" onClick={addSkill} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <Badge key={skill} variant={getSkillColor(skill)} className="flex items-center gap-1">
                        {skill}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeSkill(skill)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <SkillsGenerationPanel
                profileSummary={profileSummary}
                candidateName={form.watch('candidate_name')}
                existingSkills={skills}
                onSkillsAccepted={(newSkills) => {
                  const uniqueSkills = [...new Set([...skills, ...newSkills])]
                  setSkills(uniqueSkills)
                }}
              />
            </div>

            {/* Profile Summary */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-text-primary border-b border-border pb-2">
                Profile Summary
              </h3>
              <RichTextEditor
                key={`profile-${candidate?.id || 'new'}`}
                value={profileSummary}
                onChange={setProfileSummary}
                placeholder="Add a brief overview of the candidate's background, experience, and key qualifications..."
                minHeight="200px"
                isExternalUpdate={profileIsExternalUpdate}
                onExternalUpdateComplete={() => setProfileIsExternalUpdate(false)}
              />
            </div>


          </form>
          </div>
        </div>

        <div className="border-t pt-4 mt-4 bg-background flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            type="submit"
            form="candidate-form"
            disabled={isLoading || (!candidate && !jobId && !selectedJobId && !organizationId)}
            title={(!candidate && !jobId && !selectedJobId && !organizationId) ? 'Select a job or organization first' : ''}
          >
            {isLoading ? 'Saving...' : (candidate ? 'Update Candidate' : 'Add Candidate')}
          </Button>
        </div>
      </SheetContent>
      
      {mergeData && (
        <CandidateMergeDialog
          isOpen={mergeDialogOpen}
          onConfirm={handleMergeConfirm}
          onCancel={handleMergeCancel}
          existingCandidate={mergeData.existing}
          newCandidate={mergeData.incoming}
          mergedCandidate={mergeData.merged}
        />
      )}
    </Sheet>
  )
}

export default CandidateFormSheet