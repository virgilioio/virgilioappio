import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { formatDistanceToNowStrict, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { FormField } from '@/components/ui/form-field'
import {
  X,
  Plus,
  Briefcase,
  Building2,
  MapPin,
  Mail,
  AtSign,
  DollarSign,
  Calendar,
  CalendarDays,
  Link2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CurrencySelect } from '@/components/ui/currency-select'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useFormPersistence } from '@/hooks/useFormPersistence'
import type { Candidate } from '@/hooks/useCandidates'
import { toast } from '@/hooks/use-toast'
import { getSkillColor } from '@/utils/skillColors'
import { SkillsGenerationPanel } from './SkillsGenerationPanel'
import { useResumeParsing } from '@/hooks/useResumeParsing'
import { sanitizeHtmlForEditor } from '@/utils/htmlSanitizer'
import { sanitizeToE164 } from '@/utils/phoneUtils'
import { PhoneInput } from '@/components/ui/phone-input'
import { markdownToHtml } from '@/utils/markdown'
import { useSkillsGeneration } from '@/hooks/useSkillsGeneration'
import { EnhancedResumeDropzone, ParsedResumeData } from './EnhancedResumeDropzone'
import { useJobsForCandidateAssignment } from '@/hooks/useJobsForCandidateAssignment'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { useCandidateSources } from '@/hooks/useCandidateSources'
import { useCandidateJobAssociations } from '@/hooks/useCandidateJobAssociations'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CandidateMergeDialog } from './CandidateMergeDialog'
import { triggerBackgroundEnrichment } from '@/hooks/useCandidateEnrichment'
import { BackgroundEnrichmentBanner } from './BackgroundEnrichmentBanner'
import { CandidateSheetHeader } from './form/CandidateSheetHeader'
import { CandidateSheetSection } from './form/CandidateSheetSection'
import { CandidateSheetFooter } from './form/CandidateSheetFooter'
import { ParsedResumeChip } from './form/ParsedResumeChip'
import { AssignmentRowCard } from './form/AssignmentRowCard'
import { IconInput } from './form/IconInput'

interface CandidateFormSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<any> | void
  candidate?: Candidate | null
  jobId?: string
  stageId?: string
  preSelectedJob?: { id: string; title: string; locked: boolean }
  isLoading: boolean
  /** Optional callback for the "Open profile" footer button (edit mode). */
  onOpenProfile?: () => void
}

interface FormData {
  candidate_name: string
  location_country: string
  location_state: string
  location_city: string
  salary_amount: string
  salary_amount_max: string
  salary_currency: string
  salary_period: string
  profile_summary: string
  notes: string
  linkedin_url: string
  email: string
  phone: string
  source: string
  // Professional (display-only, persisted as part of submit if backend supports)
  current_role: string
  current_company: string
  years_experience: string
  referred_by: string
}

const MAX_VISIBLE_SKILLS = 7

export function CandidateFormSheet({
  isOpen,
  onClose,
  onSubmit,
  candidate,
  jobId,
  stageId,
  preSelectedJob,
  isLoading,
  onOpenProfile,
}: CandidateFormSheetProps) {
  const [profileSummary, setProfileSummary] = useState('')
  const [profileIsExternalUpdate, setProfileIsExternalUpdate] = useState(false)
  const [notes, setNotes] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [currentCandidateId, setCurrentCandidateId] = useState<string | null>(null)
  const { user, organizationId } = useAuth()
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isUploadingResume, setIsUploadingResume] = useState(false)
  const isMountedRef = useRef(true)
  const [capturedResumeText, setCapturedResumeText] = useState<string>('')
  const [showEnrichmentBanner, setShowEnrichmentBanner] = useState(false)
  const [parsedFieldsCount, setParsedFieldsCount] = useState<number>(0)
  const [shouldResetAfterSubmit, setShouldResetAfterSubmit] = useState(false)

  // Job assignment state (only for create mode)
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [selectedStageId, setSelectedStageId] = useState<string>('')

  // Hooks for job assignment
  const { jobs: availableJobs, isLoading: isLoadingJobs } = useJobsForCandidateAssignment()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const [jobStages, setJobStages] = useState<Array<{ jhsId: string; stage: any; position: number }>>([])

  // Candidate sources
  const { sources: candidateSources, isLoading: isLoadingSources } = useCandidateSources('organization')
  const [isLoadingStages, setIsLoadingStages] = useState(false)

  // Job associations for edit mode (pipeline count + assignments list)
  const { jobAssociations, refetch: refetchAssociations } = useCandidateJobAssociations(
    candidate?.id ?? null,
  )

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const { isParsing, parseResume } = useResumeParsing()
  const { generateSkills, isGenerating } = useSkillsGeneration()

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
      salary_amount_max: '',
      salary_currency: 'USD',
      salary_period: 'annually',
      profile_summary: '',
      notes: '',
      linkedin_url: '',
      email: '',
      phone: '',
      source: '',
      current_role: '',
      current_company: '',
      years_experience: '',
      referred_by: '',
    },
  })

  const { clearPersistedData } = useFormPersistence({
    storageKey: `candidate-form-${jobId}`,
    form,
    enabled: isOpen && !candidate,
    debounceMs: 300,
  })

  // ── Effect: hydrate form when editing existing candidate ──────────────────
  useEffect(() => {
    if (candidate && isOpen) {
      const candidateChanged = currentCandidateId !== candidate.id
      if (candidateChanged || currentCandidateId === null) {
        setCurrentCandidateId(candidate.id)
        form.reset({
          candidate_name: candidate.candidate_name || '',
          location_country: candidate.location_country || '',
          location_state: candidate.location_state || '',
          location_city: candidate.location_city || '',
          salary_amount: candidate.salary_amount?.toString() || '',
          salary_amount_max: (candidate as any).salary_amount_max?.toString() || '',
          salary_currency: candidate.salary_currency || 'USD',
          salary_period: candidate.salary_period || 'annually',
          profile_summary: candidate.profile_summary || '',
          notes: candidate.notes || '',
          linkedin_url: candidate.linkedin_url || '',
          email: candidate.email || '',
          phone: candidate.phone || '',
          source: candidate.source || '',
          current_role: (candidate as any).current_job_title || '',
          current_company: (candidate as any).current_company || '',
          years_experience: (candidate as any).total_years_experience?.toString() || '',
          referred_by: (candidate as any).referred_by || '',
        })
        const sanitizedProfile = sanitizeHtmlForEditor(
          markdownToHtml(candidate.profile_summary || ''),
        )
        setProfileSummary(sanitizedProfile)
        setProfileIsExternalUpdate(true)
        setNotes(candidate.notes || '')
        setSkills(candidate.skills || [])
      }
    } else if (!candidate && isOpen) {
      setCurrentCandidateId(null)
    }
  }, [candidate, isOpen, form])

  // ── Effect: pre-selected job / initial state ──────────────────────────────
  useEffect(() => {
    if (isOpen && !candidate) {
      if (preSelectedJob) {
        setSelectedJobId(preSelectedJob.id)
        loadStagesForJob(preSelectedJob.id, !stageId)
        if (stageId) setSelectedStageId(stageId)
      } else {
        setSelectedJobId(jobId || '')
        setSelectedStageId(stageId || '')
        if (jobId) loadStagesForJob(jobId, !stageId)
      }
    }
  }, [isOpen, candidate, preSelectedJob, jobId, stageId])

  const loadStagesForJob = async (jobIdToLoad: string, autoSelectFirst: boolean = false) => {
    if (!jobIdToLoad) {
      setJobStages([])
      return
    }
    setIsLoadingStages(true)
    try {
      const stages = await loadHiringPlanInstances(jobIdToLoad)
      setJobStages(stages)
      if (autoSelectFirst && stages.length > 0 && !stageId) {
        setSelectedStageId(stages[0].jhsId)
      }
    } catch (error) {
      console.error('Error loading stages:', error)
      setJobStages([])
    } finally {
      setIsLoadingStages(false)
    }
  }

  const handleJobChange = async (newJobId: string) => {
    setSelectedJobId(newJobId)
    setSelectedStageId('')
    if (newJobId) await loadStagesForJob(newJobId, true)
    else setJobStages([])
  }

  // ── Effect: reset on close (for new candidates) ───────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setCurrentCandidateId(null)
      if (!candidate) resetFormState()
    }
  }, [isOpen, candidate])

  const resetFormState = () => {
    form.reset({
      candidate_name: '',
      location_country: '',
      location_state: '',
      location_city: '',
      salary_amount: '',
      salary_amount_max: '',
      salary_currency: 'USD',
      salary_period: 'annually',
      profile_summary: '',
      notes: '',
      linkedin_url: '',
      email: '',
      phone: '',
      source: '',
      current_role: '',
      current_company: '',
      years_experience: '',
      referred_by: '',
    })
    setProfileSummary('')
    setNotes('')
    setSkills([])
    setNewSkill('')
    setSelectedJobId('')
    setSelectedStageId('')
    setJobStages([])
    setPendingFiles([])
    setCapturedResumeText('')
    setShowEnrichmentBanner(false)
    setParsedFieldsCount(0)
    setShowAllSkills(false)
  }

  const validateLinkedInUrl = (url: string) => {
    if (!url) return true
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
        for (const [index, f] of fileArray.entries()) {
          await uploadFileForCandidate(candidate.id, f, index === 0)
        }
        toast({ title: 'Resume uploaded', description: 'Attachment added to candidate.' })
      } catch (e) {
        // errors already toasted below
      } finally {
        setIsUploadingResume(false)
      }
    } else {
      // New candidate: queue files to upload after creation
      fileArray.forEach(addPendingFile)

      // Use enhanced dropzone for parsing when creating new candidates
      const first = fileArray[0]
      if (first) {
        // Enhanced dropzone will handle parsing and skills generation
      }
    }
  }

  const addPendingFile = (file: File) => {
    setPendingFiles((prev) => {
      const alreadyQueued = prev.some((f) => f.name === file.name && f.size === file.size)
      if (alreadyQueued) return prev
      return [...prev, file]
    })
  }

  const removePendingFile = (name: string, size: number) => {
    setPendingFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)))
  }

  const uploadFileForCandidate = async (
    jobCandidateId: string,
    file: File,
    markAsResume: boolean = false,
  ) => {
    if (!user) throw new Error('Not authenticated')
    try {
      const ext = file.name.split('.').pop()
      const storagePath = `${jobCandidateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: storageError } = await supabase.storage
        .from('candidate-attachments')
        .upload(storagePath, file)
      if (storageError) throw storageError

      if (markAsResume) {
        const { error: clearResumeFlagError } = await supabase
          .from('candidate_attachments')
          .update({ is_resume: false })
          .eq('candidate_id', jobCandidateId)
          .eq('is_resume', true)
        if (clearResumeFlagError) throw clearResumeFlagError
      }

      const { error: dbError } = await supabase.from('candidate_attachments').insert({
        candidate_id: jobCandidateId,
        file_name: file.name,
        file_url: storagePath,
        file_size_bytes: file.size,
        file_type: file.type,
        uploaded_by: user.id,
        is_resume: markAsResume,
      })
      if (dbError) {
        await supabase.storage.from('candidate-attachments').remove([storagePath])
        throw dbError
      }

      if (markAsResume) {
        await supabase
          .from('candidates')
          .update({ resume_url: storagePath })
          .eq('id', jobCandidateId)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload resume'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
      throw err
    }
  }

  const handlePostSubmitActions = async (result: any, filesToUpload?: File[]) => {
    const files = filesToUpload || pendingFiles
    if (!candidate) {
      const candidateId = result?.id
      if (files.length > 0 && candidateId) {
        try {
          setIsUploadingResume(true)
          for (const [index, f] of files.entries()) {
            await uploadFileForCandidate(candidateId, f, index === 0)
          }
          toast({ title: 'Resume uploaded', description: 'Attachment added to candidate.' })
          setPendingFiles([])
        } catch (error) {
          toast({
            title: 'Resume upload failed',
            description:
              'The candidate was created, but the resume file could not be saved. Please re-upload it from the candidate profile.',
            variant: 'destructive',
          })
        } finally {
          setIsUploadingResume(false)
        }
      }
      if (candidateId && capturedResumeText) {
        triggerBackgroundEnrichment(candidateId, capturedResumeText, form.getValues('candidate_name'))
        setCapturedResumeText('')
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
    if (!candidate && !jobId) {
      if (!selectedJobId && !organizationId) {
        toast({
          title: 'Selection Required',
          description: 'Select a job (or organization) before creating a candidate.',
          variant: 'destructive',
        })
        return
      }
    }

    let normalizedLinkedInUrl = data.linkedin_url?.trim() || ''
    if (normalizedLinkedInUrl && !normalizedLinkedInUrl.match(/^https?:\/\//i)) {
      normalizedLinkedInUrl = `https://${normalizedLinkedInUrl}`
    }

    const submitData = {
      ...data,
      email: data.email?.trim() ? data.email.trim() : null,
      phone: data.phone?.trim() ? sanitizeToE164(data.phone.trim()) : null,
      linkedin_url: normalizedLinkedInUrl || null,
      salary_amount: data.salary_amount ? Number(data.salary_amount) : null,
      salary_amount_max: data.salary_amount_max ? Number(data.salary_amount_max) : null,
      profile_summary: sanitizeHtmlForEditor(profileSummary),
      notes,
      skills: skills.length > 0 ? skills : null,
      source: data.source || null,
      job_id: jobId,
      ...(!candidate && {
        assignedJobId: selectedJobId || null,
        assignedStageId: selectedStageId || null,
      }),
    }

    setPendingSubmitData(submitData)
    const filesToUpload = [...pendingFiles]
    const result = await onSubmit(submitData as any)

    if (result && (result as any).wasMerged) {
      setMergeData({
        existing: (result as any).existingData,
        incoming: submitData,
        merged: (result as any).mergedData,
      })
      setMergeDialogOpen(true)
      return
    }

    if (result) {
      await handlePostSubmitActions(result, filesToUpload)
    }

    // Save & add another flow
    if (shouldResetAfterSubmit && !candidate) {
      setShouldResetAfterSubmit(false)
      resetFormState()
      return
    }
  })

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()])
      setNewSkill('')
    }
  }

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove))
  }

  const handleSkillKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill()
    }
  }

  const handleDismiss = () => {
    if (candidate) setCurrentCandidateId(null)
    onClose()
  }

  const handleCancel = () => {
    resetFormState()
    clearPersistedData()
    setCurrentCandidateId(null)
    onClose()
  }

  // ── Derived metadata ──────────────────────────────────────────────────────
  const pipelineCount = jobAssociations.length

  const isEdit = !!candidate
  const titleText = isEdit
    ? candidate?.candidate_name || 'Edit candidate'
    : 'Add candidate'
  const subtitleText = isEdit
    ? "Update this candidate's details. Changes apply everywhere they appear — talent pool and every job pipeline they're in."
    : 'Drop a resume to auto-fill, or enter their details manually. Assigning a job is optional — skip it to keep them in your talent pool.'

  const addedLabel = useMemo(() => {
    const created = (candidate as any)?.created_at
    if (!created) return undefined
    try {
      return format(new Date(created), 'MMM d, yyyy')
    } catch {
      return undefined
    }
  }, [candidate])

  const editedLabel = useMemo(() => {
    const updated = (candidate as any)?.updated_at
    if (!updated) return undefined
    try {
      const dist = formatDistanceToNowStrict(new Date(updated), { addSuffix: false })
      // Compact "Xd ago" style per concise-relative-time-formatting memory
      const num = dist.match(/^\d+/)?.[0] ?? ''
      const unit = dist.replace(/^\d+\s?/, '').charAt(0)
      return `${num}${unit} ago`
    } catch {
      return undefined
    }
  }, [candidate])

  const visibleSkills = showAllSkills ? skills : skills.slice(0, MAX_VISIBLE_SKILLS)
  const hiddenSkillsCount = Math.max(0, skills.length - MAX_VISIBLE_SKILLS)

  const isSubmitDisabled =
    isLoading || (!candidate && !jobId && !selectedJobId && !organizationId)
  const submitDisabledTitle =
    !candidate && !jobId && !selectedJobId && !organizationId
      ? 'Select a job or organization first'
      : undefined

  if (!user) return null

  // ── Skill chip tone helper (map legacy variant → tone) ────────────────────
  const SKILL_VARIANT_TO_TONE: Record<string, any> = {
    'pastel-blue': 'blue',
    'pastel-purple': 'purple',
    'pastel-green': 'green',
    'pastel-pink': 'pink',
    'pastel-yellow': 'yellow',
    'pastel-orange': 'orange',
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleDismiss}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[720px] p-0 flex flex-col h-full bg-[#F6F5F1] border-l border-virgilio-border"
      >
        <SheetHeader className="px-6 pt-6 pb-5 border-b border-virgilio-border/60 bg-background space-y-0">
          <CandidateSheetHeader
            title={titleText}
            subtitle={subtitleText}
            pipelineCount={isEdit ? pipelineCount : undefined}
          />
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <form id="candidate-form" onSubmit={handleSubmit} className="px-6 py-6 space-y-7">
            {/* ── RESUME ──────────────────────────────────────────────── */}
            <CandidateSheetSection
              label="Resume"
              rightMeta={
                isEdit ? (
                  <span className="font-poppins text-[11px] text-virgilio-muted">
                    v1 · current
                  </span>
                ) : parsedFieldsCount > 0 ? (
                  <Badge tone="green" dot size="xs">
                    {parsedFieldsCount} fields auto-filled
                  </Badge>
                ) : null
              }
            >
              {!isEdit && pendingFiles.length > 0 ? (
                <ParsedResumeChip
                  fileName={pendingFiles[0].name}
                  metaLine={`${Math.round(pendingFiles[0].size / 1024)} KB · ready to upload${
                    parsedFieldsCount > 0 ? ` · ${parsedFieldsCount} fields auto-filled` : ''
                  }`}
                  parsed={parsedFieldsCount > 0}
                  onDelete={() => removePendingFile(pendingFiles[0].name, pendingFiles[0].size)}
                />
              ) : (
                <EnhancedResumeDropzone
                  variant="compact"
                  onUpload={
                    candidate
                      ? (file) => uploadFileForCandidate(candidate.id, file, true)
                      : undefined
                  }
                  onParsed={(parsed: ParsedResumeData) => {
                    let count = 0
                    if (parsed.name) {
                      form.setValue('candidate_name', parsed.name)
                      count++
                    }
                    if (parsed.email) {
                      form.setValue('email', parsed.email)
                      count++
                    }
                    if (parsed.phone) {
                      form.setValue('phone', sanitizeToE164(parsed.phone))
                      count++
                    }
                    if (parsed.linkedinUrl) {
                      let normalizedUrl = parsed.linkedinUrl.trim()
                      if (!normalizedUrl.match(/^https?:\/\//i)) {
                        normalizedUrl = `https://${normalizedUrl}`
                      }
                      form.setValue('linkedin_url', normalizedUrl)
                      count++
                    }
                    if (parsed.location) {
                      const parts = parsed.location.split(',').map((s) => s.trim())
                      if (parts.length === 3) {
                        form.setValue('location_city', parts[0])
                        form.setValue('location_state', parts[1])
                        form.setValue('location_country', parts[2])
                        count += 3
                      } else if (parts.length === 2) {
                        form.setValue('location_city', parts[0])
                        form.setValue('location_country', parts[1])
                        count += 2
                      } else {
                        form.setValue('location_city', parsed.location)
                        count++
                      }
                    }
                    if (parsed.profileSummary) {
                      const html = sanitizeHtmlForEditor(
                        parsed.profileSummary.includes('<')
                          ? parsed.profileSummary
                          : markdownToHtml(parsed.profileSummary),
                      )
                      setProfileSummary(html)
                      setProfileIsExternalUpdate(true)
                      count++
                    }
                    setParsedFieldsCount(count)
                  }}
                  onSkillsGenerated={(newSkills: string[]) => {
                    setSkills((prev) => [...new Set([...prev, ...newSkills])])
                    setParsedFieldsCount((c) => c + newSkills.length)
                  }}
                  isUploading={isUploadingResume}
                  candidateId={candidate?.id}
                  candidateName={form.watch('candidate_name')}
                  autoGenerateSkills={!!candidate}
                  showUpload={!!candidate}
                  parseOnly={!candidate}
                  useTwoStageAI={!candidate}
                  onFileCaptured={(file) => {
                    if (!candidate) addPendingFile(file)
                  }}
                  onResumeTextCaptured={(text) => {
                    if (!candidate) {
                      setCapturedResumeText(text)
                      setShowEnrichmentBanner(true)
                    }
                  }}
                />
              )}

              {!candidate && showEnrichmentBanner && capturedResumeText && (
                <BackgroundEnrichmentBanner
                  isVisible={true}
                  onDismiss={() => setShowEnrichmentBanner(false)}
                />
              )}
            </CandidateSheetSection>

            {/* ── IDENTITY ────────────────────────────────────────────── */}
            <CandidateSheetSection label="Identity">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Name"
                  required
                  error={form.formState.errors.candidate_name?.message}
                  htmlFor="candidate_name"
                >
                  <Input
                    id="candidate_name"
                    {...form.register('candidate_name', { required: 'Name is required' })}
                    placeholder="Lena Park"
                  />
                </FormField>

                <FormField label="Email" required htmlFor="email" helpText={isEdit ? 'Changing this will not affect existing conversation threads.' : 'Used to detect duplicate candidates.'}>
                  <IconInput
                    id="email"
                    type="email"
                    icon={Mail}
                    {...form.register('email')}
                    placeholder="name@example.com"
                  />
                </FormField>

                <FormField label="Phone" htmlFor="phone" helpText="Optional">
                  <PhoneInput
                    id="phone"
                    value={form.watch('phone') || ''}
                    onChange={(val) => form.setValue('phone', val, { shouldDirty: true })}
                    placeholder="+1 (555) 555-2848"
                  />
                </FormField>

                <FormField
                  label="LinkedIn URL"
                  htmlFor="linkedin_url"
                  helpText="Optional"
                  error={form.formState.errors.linkedin_url?.message}
                >
                  <IconInput
                    id="linkedin_url"
                    icon={AtSign}
                    {...form.register('linkedin_url', { validate: validateLinkedInUrl })}
                    placeholder="linkedin.com/in/username"
                  />
                </FormField>
              </div>
            </CandidateSheetSection>

            {/* ── PROFESSIONAL ────────────────────────────────────────── */}
            <CandidateSheetSection label="Professional">
              <FormField label="Current role" htmlFor="current_role">
                <IconInput
                  id="current_role"
                  icon={Briefcase}
                  {...form.register('current_role')}
                  placeholder="Senior Product Designer"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Current company" htmlFor="current_company">
                  <IconInput
                    id="current_company"
                    icon={Building2}
                    {...form.register('current_company')}
                    placeholder="Linear"
                  />
                </FormField>

                <FormField label="Years experience" htmlFor="years_experience">
                  <IconInput
                    id="years_experience"
                    type="number"
                    {...form.register('years_experience')}
                    placeholder="7"
                    trailing="years"
                  />
                </FormField>
              </div>

              <FormField label="Location" htmlFor="location_city">
                <IconInput
                  id="location_city"
                  icon={MapPin}
                  {...form.register('location_city')}
                  placeholder="Brooklyn, NY"
                />
              </FormField>
              {/* Hidden persistence for legacy state/country split */}
              <input type="hidden" {...form.register('location_state')} />
              <input type="hidden" {...form.register('location_country')} />

              <div className="space-y-2">
                <label className="text-sm font-medium text-virgilio-text">
                  Salary expectations{' '}
                  <span className="font-normal text-virgilio-muted">(optional)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <CurrencySelect
                    value={form.watch('salary_currency')}
                    onChange={(value) => form.setValue('salary_currency', value)}
                  />
                  <IconInput
                    type="number"
                    icon={DollarSign}
                    {...form.register('salary_amount')}
                    placeholder="185,000"
                  />
                  <IconInput
                    type="number"
                    icon={DollarSign}
                    {...form.register('salary_amount_max')}
                    placeholder="210,000"
                  />
                  <Select
                    value={form.watch('salary_period')}
                    onValueChange={(value) => form.setValue('salary_period', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">/ hour</SelectItem>
                      <SelectItem value="daily">/ day</SelectItem>
                      <SelectItem value="monthly">/ month</SelectItem>
                      <SelectItem value="annually">/ year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CandidateSheetSection>

            {/* ── SKILLS ──────────────────────────────────────────────── */}
            <CandidateSheetSection
              label="Skills"
              rightMeta={
                skills.length > 0 ? (
                  <Badge tone={isEdit ? 'neutral' : 'green'} size="xs">
                    {skills.length} {isEdit ? 'total' : 'detected'}
                  </Badge>
                ) : null
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {visibleSkills.map((skill) => (
                  <Badge
                    key={skill}
                    tone={SKILL_VARIANT_TO_TONE[getSkillColor(skill)] || 'neutral'}
                    size="md"
                    onRemove={() => removeSkill(skill)}
                  >
                    {skill}
                  </Badge>
                ))}
                {!showAllSkills && hiddenSkillsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSkills(true)}
                    className="inline-flex h-badge-md items-center rounded-full bg-muted px-[11px] text-[12px] font-inter font-medium text-virgilio-muted hover:bg-virgilio-border/60 transition-colors"
                  >
                    + {hiddenSkillsCount} more
                  </button>
                )}
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={handleSkillKeyPress}
                  onBlur={() => newSkill.trim() && addSkill()}
                  placeholder="Add skill…"
                  className="flex-1 min-w-[120px] h-badge-md bg-transparent px-2 text-[12px] font-inter text-virgilio-text placeholder:text-virgilio-muted focus:outline-none"
                />
              </div>

              <SkillsGenerationPanel
                profileSummary={profileSummary}
                candidateName={form.watch('candidate_name')}
                existingSkills={skills}
                onSkillsAccepted={(newSkills) => {
                  setSkills((prev) => [...new Set([...prev, ...newSkills])])
                }}
              />
            </CandidateSheetSection>

            {/* ── PROFILE SUMMARY (kept; outside mockup crops) ───────── */}
            <CandidateSheetSection label="Profile summary" bare>
              <div className="rounded-xl ring-1 ring-virgilio-border/60 bg-background p-4">
                <RichTextEditor
                  key={`profile-${candidate?.id || 'new'}`}
                  value={profileSummary}
                  onChange={setProfileSummary}
                  placeholder="Add a brief overview of the candidate's background, experience, and key qualifications…"
                  minHeight="180px"
                  isExternalUpdate={profileIsExternalUpdate}
                  onExternalUpdateComplete={() => setProfileIsExternalUpdate(false)}
                />
              </div>
            </CandidateSheetSection>

            {/* ── CURRENT ASSIGNMENTS (edit only) ─────────────────────── */}
            {isEdit && (
              <CandidateSheetSection
                label="Current assignments"
                action={
                  <Button type="button" variant="ghost" size="sm" icon={Plus}>
                    Add to a job
                  </Button>
                }
              >
                {jobAssociations.length === 0 ? (
                  <p className="text-sm text-virgilio-muted">
                    Not currently assigned to any job pipeline.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {jobAssociations.map((a) => (
                      <AssignmentRowCard
                        key={a.id}
                        jobTitle={a.job?.title || 'Untitled job'}
                        department={a.job?.organization?.name || null}
                        stageName={a.status || null}
                        stageTone="purple"
                      />
                    ))}
                  </div>
                )}
                <p className="flex items-center gap-1.5 text-xs text-virgilio-muted pt-1">
                  <span aria-hidden>ⓘ</span>
                  Removing every job returns this candidate to the talent pool as independent.
                </p>
              </CandidateSheetSection>
            )}

            {/* ── SOURCE & ASSIGNMENT (add) / SOURCE (edit) ──────────── */}
            <CandidateSheetSection
              label={isEdit ? 'Source' : 'Source & assignment'}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Source"
                  required
                  error={form.formState.errors.source?.message}
                  htmlFor="source"
                >
                  <SearchableSelect
                    options={candidateSources.map((s) => ({ value: s.name, label: s.name }))}
                    value={form.watch('source')}
                    onValueChange={(val) =>
                      form.setValue('source', val, { shouldValidate: true, shouldDirty: true })
                    }
                    placeholder={isLoadingSources ? 'Loading sources…' : 'Select source…'}
                    searchPlaceholder="Search sources…"
                    emptyMessage="No sources found"
                    disabled={isLoadingSources}
                    error={form.formState.errors.source?.message}
                    required
                  />
                  <input
                    type="hidden"
                    {...form.register('source', { required: 'Source is required' })}
                  />
                </FormField>

                <FormField label="Referred by" htmlFor="referred_by" helpText="Optional">
                  <IconInput
                    id="referred_by"
                    icon={Link2}
                    {...form.register('referred_by')}
                    placeholder="Karl Yu"
                  />
                </FormField>
              </div>

              {!isEdit && (
                <>
                  <FormField
                    label="Assign to a job"
                    htmlFor="job_assignment"
                    helpText="Optional — added to this job's pipeline at the stage below."
                  >
                    <SearchableSelect
                      options={availableJobs.map((job) => ({
                        value: job.id,
                        label: job.display_label,
                      }))}
                      value={selectedJobId}
                      onValueChange={handleJobChange}
                      placeholder={isLoadingJobs ? 'Loading jobs…' : 'Select a job…'}
                      searchPlaceholder="Search jobs…"
                      disabled={isLoadingJobs || (preSelectedJob?.locked ?? false)}
                    />
                  </FormField>

                  {selectedJobId && jobStages.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-virgilio-text">
                        Starting stage
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {jobStages.map((stageOption) => {
                          const isSelected = selectedStageId === stageOption.jhsId
                          return (
                            <button
                              key={stageOption.jhsId}
                              type="button"
                              onClick={() => setSelectedStageId(stageOption.jhsId)}
                              className={
                                isSelected
                                  ? 'inline-flex h-badge-md items-center gap-1.5 rounded-full bg-badge-lilac px-[11px] text-[12px] font-inter font-medium text-badge-lilac-foreground ring-1 ring-virgilio-purple/30'
                                  : 'inline-flex h-badge-md items-center rounded-full bg-muted px-[11px] text-[12px] font-inter font-medium text-virgilio-muted hover:bg-virgilio-border/60 transition-colors'
                              }
                            >
                              {isSelected && (
                                <span className="h-1.5 w-1.5 rounded-full bg-virgilio-purple" />
                              )}
                              {stageOption.stage.stage_name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {availableJobs.length === 0 && !isLoadingJobs && (
                    <div className="text-xs text-virgilio-muted">
                      No jobs available — candidate will be added to your talent pool.
                    </div>
                  )}
                </>
              )}
            </CandidateSheetSection>
          </form>
        </div>

        <CandidateSheetFooter
          mode={isEdit ? 'edit' : 'add'}
          isLoading={isLoading || isUploadingResume}
          isSubmitDisabled={isSubmitDisabled}
          submitTitle={submitDisabledTitle}
          onCancel={handleCancel}
          onSubmit={() => {
            /* native submit via form id */
          }}
          dedupeCount={null}
          onSaveAndAddAnother={
            !isEdit
              ? () => {
                  setShouldResetAfterSubmit(true)
                  // Trigger the form's submit programmatically
                  const formEl = document.getElementById('candidate-form') as HTMLFormElement | null
                  formEl?.requestSubmit()
                }
              : undefined
          }
          addedLabel={addedLabel}
          editedLabel={editedLabel}
          onOpenProfile={onOpenProfile}
        />
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
