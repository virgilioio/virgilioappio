import React, { useState, useEffect, useRef } from 'react'
import { useStepSlide } from '@/lib/motion'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJobs, CreateJobData } from '@/hooks/useJobs'
import { toast } from '@/hooks/use-toast'
import { JobInfoStep, AiAssistedBadge } from './wizard/JobInfoStep'
import { HiringPlanStep } from './wizard/HiringPlanStep'
import { HiringTeamStep } from './wizard/HiringTeamStep'
import { SummaryStep } from './wizard/SummaryStep'
import { JobPostingStep, type JobPostingStepHandle } from './wizard/JobPostingStep'
import { useJobSourcingProject } from '@/hooks/useJobSourcingProject'
import { supabase } from '@/integrations/supabase/client'
import { insertOpenings } from '@/hooks/useJobOpenings'
import type { OpeningRow } from '@/lib/jobOpenings'

interface JobWizardProps {
  isOpen: boolean
  onClose: () => void
  initialData?: Partial<CreateJobData> & { sourceJobTitle?: string }
  /** Reopen an existing wizard draft at its saved step. */
  resumeJobId?: string | null
}

const JOB_DATA_KEYS = [
  'title', 'description', 'location', 'department', 'salary_min', 'salary_max', 'currency', 'status',
  'skills', 'auto_generated_skills', 'last_skills_generation', 'hiring_team', 'organization_id',
  'department_id', 'internal_title', 'job_level', 'work_mode', 'employment_type', 'additional_locations',
  'show_salary_public', 'include_equity', 'include_signing_bonus', 'min_years_experience',
  'max_years_experience', 'priority',
] as const

export interface HiringPlanUiState {
  selectedTemplate: 'workspace_default' | 'lean_tech' | 'exec_leadership' | null
  rejectOutsideLocations: boolean
  rejectSalaryAbove: boolean
  rejectRepeatApplicant: boolean
  autoScore: boolean
  autoRejectBelow: boolean
  autoRejectThreshold: number
  generateSummary: boolean
}

export interface HiringTeamUiState {
  reportsToId: string
  coordinatorId: string
  notifyOnApplications: boolean
  dailyDigest: boolean
  notifyStageMoves: boolean
  memberSearch: string
}

const DEFAULT_HIRING_PLAN_UI: HiringPlanUiState = {
  selectedTemplate: null,
  rejectOutsideLocations: true,
  rejectSalaryAbove: true,
  rejectRepeatApplicant: false,
  autoScore: true,
  autoRejectBelow: true,
  autoRejectThreshold: 35,
  generateSummary: true,
}

const DEFAULT_HIRING_TEAM_UI: HiringTeamUiState = {
  reportsToId: '',
  coordinatorId: '__same__',
  notifyOnApplications: true,
  dailyDigest: true,
  notifyStageMoves: false,
  memberSearch: '',
}

interface WizardState {
  currentStep: number
  isComplete: boolean
  createdJobId: string | null
  jobData: Partial<CreateJobData>
  hasPosting: boolean
  hiringPlanUi: HiringPlanUiState
  hiringTeamUi: HiringTeamUiState
}

const STEPS = [
  { id: 1, title: 'Job information' },
  { id: 2, title: 'Hiring plan' },
  { id: 3, title: 'Hiring team' },
  { id: 4, title: 'Job posting' },
  { id: 5, title: 'Summary' },
]

const STEP_META: Record<
  number,
  { eyebrow: string; title: string; subtitle: string; ai?: boolean }
> = {
  1: {
    eyebrow: 'Create job · Step 1 of 5',
    title: 'Job information',
    subtitle:
      'The basics, description, and skills. Department, salary, and currency become part of the public posting.',
    ai: true,
  },
  2: {
    eyebrow: 'Create job · Step 2 of 5',
    title: 'Hiring plan',
    subtitle:
      'The stages candidates progress through. Drag to reorder. Application review and Offer are required system stages.',
  },
  3: {
    eyebrow: 'Create job · Step 3 of 5',
    title: 'Hiring team',
    subtitle:
      "Who can see this job, and what they can do. Add as many people as needed; assign roles for what they'll do on this job specifically.",
  },
  4: {
    eyebrow: 'Create job · Step 4 of 5',
    title: 'Job posting',
    subtitle:
      'The public-facing listing — how candidates discover, read, and apply to this role. You can publish to your careers page and cross-post to job boards.',
    ai: true,
  },
  5: {
    eyebrow: 'Create job · Step 5 of 5',
    title: 'Summary',
    subtitle: 'Review everything and publish.',
  },
}

export function JobWizard({ isOpen, onClose, initialData, resumeJobId }: JobWizardProps) {
  const seedData = (): Partial<CreateJobData> => {
    if (!initialData) return { status: 'draft', priority: 'standard' }
    const { sourceJobTitle, ...rest } = initialData as any
    return { status: 'draft', priority: 'standard', ...rest }
  }

  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 1,
    isComplete: false,
    createdJobId: null,
    jobData: seedData(),
    hasPosting: false,
    hiringPlanUi: { ...DEFAULT_HIRING_PLAN_UI },
    hiringTeamUi: { ...DEFAULT_HIRING_TEAM_UI },
  })

  const { createJob, updateJob } = useJobs()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const postingRef = React.useRef<JobPostingStepHandle>(null)
  const mainRef = React.useRef<HTMLElement>(null)
  const [postingMeta, setPostingMeta] = useState({ channels: 1, fields: 9 })
  const [autoSource, setAutoSource] = useState(true)
  const [publishImmediately, setPublishImmediately] = useState(true)
  const [notifySlack, setNotifySlack] = useState(false)
  const [createdPostingId, setCreatedPostingId] = useState<string | null>(null)
  const { ensureProject: ensureSourcingProject } = useJobSourcingProject(
    wizardState.createdJobId && wizardState.createdJobId !== 'created'
      ? wizardState.createdJobId
      : null,
  )

  // §7 Wizard: Next slides the new step in from the right, Back from the left.
  const stepRef = useRef<HTMLDivElement>(null)
  useStepSlide(stepRef, wizardState.currentStep)

  // Reset scroll position on step change — UX: always start at top of new step.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [wizardState.currentStep])


  const [openings, setOpenings] = useState<OpeningRow[]>([])
  const [openingsValid, setOpeningsValid] = useState(false)
  const [openingsSaved, setOpeningsSaved] = useState(false)

  const resetWizard = () => {
    setOpenings([])
    setOpeningsValid(false)
    setOpeningsSaved(false)
    resetWizardState()
  }
  const resetWizardState = () =>
    setWizardState({
      currentStep: 1,
      isComplete: false,
      createdJobId: null,
      jobData: seedData(),
      hasPosting: false,
      hiringPlanUi: { ...DEFAULT_HIRING_PLAN_UI },
      hiringTeamUi: { ...DEFAULT_HIRING_TEAM_UI },
    })

  const updateHiringPlanUi = (patch: Partial<HiringPlanUiState>) =>
    setWizardState((prev) => ({ ...prev, hiringPlanUi: { ...prev.hiringPlanUi, ...patch } }))

  const updateHiringTeamUi = (patch: Partial<HiringTeamUiState>) =>
    setWizardState((prev) => ({ ...prev, hiringTeamUi: { ...prev.hiringTeamUi, ...patch } }))

  useEffect(() => {
    if (!isOpen) {
      resetWizard()
      setSaveState('idle')
      lastSavedRef.current = ''
    } else if (resumeJobId) {
      void resumeDraft(resumeJobId)
    } else if (initialData) {
      // Re-seed when opening with new initialData
      setWizardState((prev) => ({ ...prev, jobData: seedData() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resumeJobId])

  const updateJobData = (data: Partial<CreateJobData>) =>
    setWizardState((prev) => ({ ...prev, jobData: { ...prev.jobData, ...data } }))

  // ---------- Draft auto-save ----------
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [, forceTick] = useState(0)
  const creatingRef = React.useRef(false)
  const lastSavedRef = React.useRef('')

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const resumeDraft = async (id: string) => {
    const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle()
    if (error || !data) {
      toast({ title: "Couldn't open this draft", description: error?.message, variant: 'destructive' })
      return
    }
    const row: any = data
    const jobData: any = {}
    for (const k of JOB_DATA_KEYS) if (row[k] !== null && row[k] !== undefined) jobData[k] = row[k]
    const step = Math.min(Math.max(Number(row.draft_step) || 1, 1), 5)
    lastSavedRef.current = JSON.stringify({ jobData, step })
    setOpeningsSaved(true)
    setOpeningsValid(true)
    setWizardState((prev) => ({ ...prev, createdJobId: id, jobData, currentStep: step }))
    setSaveState('saved')
    setSavedAt(new Date(row.updated_at))
    toast({ title: 'Picked up where you left off' })
  }

  useEffect(() => {
    if (!isOpen || wizardState.isComplete) return
    const { jobData, currentStep, createdJobId } = wizardState
    if (!jobData.title?.trim() || !jobData.department_id || !jobData.organization_id) return
    const snapshot = JSON.stringify({ jobData, step: currentStep })
    if (snapshot === lastSavedRef.current) return
    const t = setTimeout(async () => {
      const payload: any = { ...jobData, draft_step: currentStep }
      delete payload.target_fill_date
      delete payload.status
      setSaveState('saving')
      try {
        if (createdJobId && createdJobId !== 'created') {
          await updateJob(createdJobId, payload, { silent: true })
        } else {
          if (creatingRef.current) return
          creatingRef.current = true
          const created: any = await createJob({ ...payload, status: 'draft' }, { silent: true })
          creatingRef.current = false
          if (created?.id) setWizardState((prev) => ({ ...prev, createdJobId: created.id }))
        }
        lastSavedRef.current = snapshot
        setSaveState('saved')
        setSavedAt(new Date())
      } catch {
        creatingRef.current = false
        setSaveState('idle')
      }
    }, 1000) // the draft auto-save cadence is a behaviour contract (CLAUDE.md); unchanged
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, wizardState.jobData, wizardState.currentStep, wizardState.createdJobId, wizardState.isComplete])

  const saveStatusText = (() => {
    if (saveState === 'saving') return 'Saving…'
    if (saveState === 'saved' && savedAt) {
      const s = Math.round((Date.now() - savedAt.getTime()) / 1000)
      const rel = s < 45 ? 'just now' : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`
      return `Draft saved · ${rel}`
    }
    return null
  })()

  const submitStep1 = async (): Promise<{ id: string; created: boolean } | null> => {
    if (isSubmitting) return null
    setIsSubmitting(true)
    try {
      // Default status to 'open' when the user completes the wizard through
      // Step 1 — they clearly intend the job to be live. Explicit Draft/Closed
      // selections from JobInfoStep are respected.
      const payload = {
        ...wizardState.jobData,
        // Jobs are always created as drafts; publishing happens on Complete,
        // after the hiring team is set (the database publish gate needs it).
        status: wizardState.jobData.status === 'closed' ? 'closed' : 'draft',
      } as CreateJobData
      delete (payload as any).target_fill_date // derived from openings
      const existingId = wizardState.createdJobId
      if (existingId && existingId !== 'created') {
        // Re-entering step 1 after the job was already created — update in place
        // instead of inserting a duplicate row.
        await updateJob(existingId, { ...(payload as any), draft_step: 1 }, { silent: true })
        if (!openingsSaved) {
          await insertOpenings(existingId, openings)
          setOpeningsSaved(true)
        }
        return { id: existingId, created: false }
      }
      const jobResult = await createJob(payload)
      const id = (jobResult as any)?.id || 'created'
      setWizardState((prev) => ({ ...prev, createdJobId: id }))
      if (id !== 'created') {
        try {
          await insertOpenings(id, openings)
          setOpeningsSaved(true)
        } catch (e: any) {
          toast({ title: 'Openings not saved', description: e?.message || 'Please fix the openings and try again.', variant: 'destructive' })
          return null
        }
      }
      return { id, created: true }
    } catch (error) {
      console.error('Error saving job step 1:', error)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNextStep = async () => {
    if (wizardState.currentStep === 1) {
      const r = await submitStep1()
      if (!r) return
      setWizardState((prev) => ({ ...prev, currentStep: 2 }))
      toast({
        title: r.created ? 'Job created' : 'Job updated',
        description: r.created
          ? 'Basic job information saved. Continue to configure hiring plan.'
          : 'Changes saved. Continue to configure hiring plan.',
      })
    } else {
      setWizardState((prev) => ({
        ...prev,
        currentStep: Math.min(prev.currentStep + 1, STEPS.length),
      }))
    }
  }

  const handlePrevStep = () =>
    setWizardState((prev) => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 1) }))

  const handleSaveAndExit = async () => {
    const { jobData, createdJobId, currentStep } = wizardState
    if (jobData.title?.trim() && jobData.department_id && jobData.organization_id) {
      setIsSubmitting(true)
      try {
        const payload: any = { ...jobData, draft_step: currentStep }
        delete payload.target_fill_date
        delete payload.status
        if (createdJobId && createdJobId !== 'created') {
          await updateJob(createdJobId, payload, { silent: true })
          if (!openingsSaved && openingsValid && openings.length) {
            await insertOpenings(createdJobId, openings)
            setOpeningsSaved(true)
          }
        } else if (!creatingRef.current) {
          const created: any = await createJob({ ...payload, status: 'draft' }, { silent: true })
          if (created?.id && openingsValid && openings.length) await insertOpenings(created.id, openings)
        }
      } catch {
        return
      } finally {
        setIsSubmitting(false)
      }
      toast({ title: 'Saved as draft', description: 'You can resume from Jobs → Drafts.' })
    }
    onClose()
  }

  const [publishError, setPublishError] = useState<string | null>(null)

  const handleComplete = async () => {
    setPublishError(null)
    // Publish the job itself (draft -> open) unless the user explicitly kept it as draft.
    const wantsOpen = (wizardState.jobData.status ?? 'open') === 'open'
    if (wantsOpen && wizardState.createdJobId && wizardState.createdJobId !== 'created') {
      try {
        await updateJob(wizardState.createdJobId, { status: 'open' } as any)
      } catch (e: any) {
        // updateJob already shows the toast; keep the wizard open with the message inline.
        setPublishError(e?.message || 'Complete the setup before publishing.')
        return
      }
    }
    setWizardState((prev) => ({ ...prev, isComplete: true }))

    // Publish the posting if the Summary toggle is ON. The posting was created
    // as a draft (is_active=false) in Step 4 so this is the moment it goes live.
    if (publishImmediately && wizardState.hasPosting && createdPostingId) {
      try {
        const { error: pubErr } = await supabase
          .from('job_postings')
          .update({ is_active: true })
          .eq('id', createdPostingId)
        if (pubErr) {
          console.error('Failed to publish posting:', pubErr)
          toast({
            title: 'Job created, but publish failed',
            description: 'Open the posting and click Publish to retry.',
            variant: 'destructive',
          })
        }
      } catch (e) {
        console.error('Failed to publish posting:', e)
      }
    }

    if (
      autoSource &&
      wizardState.createdJobId &&
      wizardState.createdJobId !== 'created'
    ) {
      try {
        await ensureSourcingProject({
          name: `Sourcing — ${wizardState.jobData.title ?? 'Job'}`,
        })
      } catch (e) {
        console.error('Failed to create sourcing project', e)
      }
    }
    toast({
      title: 'Job Created Successfully!',
      description:
        publishImmediately && wizardState.hasPosting
          ? 'Your job is live on your careers page.'
          : 'Your job has been created and is ready for candidates.',
    })
    if (wizardState.createdJobId && wizardState.createdJobId !== 'created') {
      window.open(`/jobs/${wizardState.createdJobId}`, '_blank')
    }
    onClose()
  }

  const canProceedStep1 = () =>
    !!wizardState.jobData.title && !!wizardState.jobData.organization_id && !!wizardState.jobData.department_id &&
    (openingsSaved || openingsValid)

  const handlePostingContinue = async () => {
    setIsSubmitting(true)
    try {
      const result = await postingRef.current?.savePosting()
      if (!result || result.ok === false) return
      if (result.postingId) setCreatedPostingId(result.postingId)
      setWizardState((prev) => ({ ...prev, currentStep: 5, hasPosting: true }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePostingSkip = () =>
    setWizardState((prev) => ({ ...prev, currentStep: 5, hasPosting: false }))

  const goToStep = (step: number) =>
    setWizardState((prev) => ({ ...prev, currentStep: step }))

  const renderStepContent = () => {
    switch (wizardState.currentStep) {
      case 1:
        return (
          <>
            {initialData?.sourceJobTitle && (
              <div className="mb-6 rounded-xl border border-virgilio-purple/20 bg-virgilio-purple/[0.06] px-4 py-3 text-[13px] font-inter text-text-primary">
                <span className="font-poppins font-medium">Duplicating from {initialData.sourceJobTitle}</span>
                <span className="text-text-secondary"> — review and edit before publishing.</span>
              </div>
            )}
            <JobInfoStep
              jobData={wizardState.jobData}
              onUpdate={updateJobData}
              openings={
                openingsSaved && wizardState.createdJobId && wizardState.createdJobId !== 'created'
                  ? { mode: 'edit', jobId: wizardState.createdJobId, onManage: () => {} }
                  : { mode: 'create', value: openings, onChange: setOpenings, onValidityChange: setOpeningsValid }
              }
            />
          </>
        )
      case 2:
        return (
          <HiringPlanStep
            jobId={wizardState.createdJobId}
            onNext={handleNextStep}
            onBack={handlePrevStep}
            ui={wizardState.hiringPlanUi}
            onUiChange={updateHiringPlanUi}
          />
        )
      case 3:
        return (
          <HiringTeamStep
            jobId={wizardState.createdJobId}
            onNext={handleNextStep}
            onBack={handlePrevStep}
            ui={wizardState.hiringTeamUi}
            onUiChange={updateHiringTeamUi}
          />
        )
      case 4:
        return (
          <JobPostingStep
            ref={postingRef}
            jobData={wizardState.jobData}
            onUpdate={updateJobData}
            jobId={wizardState.createdJobId}
            onPostingMeta={setPostingMeta}
          />
        )

      case 5:
        return (
          <SummaryStep
            openings={openings}
            jobData={wizardState.jobData}
            jobId={wizardState.createdJobId}
            hasPosting={wizardState.hasPosting}
            postingMeta={postingMeta}
            onGoToStep={goToStep}
            autoSource={autoSource}
            onAutoSourceChange={setAutoSource}
            publishImmediately={publishImmediately}
            onPublishImmediatelyChange={setPublishImmediately}
            notifySlack={notifySlack}
            onNotifySlackChange={setNotifySlack}
          />
        )
      default:
        return null
    }
  }

  const meta = STEP_META[wizardState.currentStep]
  const showFooter = wizardState.currentStep >= 1 && wizardState.currentStep <= 5

  const primaryCta = (() => {
    switch (wizardState.currentStep) {
      case 1:
        return { label: wizardState.createdJobId ? 'Save & continue' : 'Create & continue', onClick: handleNextStep, disabled: !canProceedStep1() || isSubmitting, loading: isSubmitting }
      case 2:
        return { label: 'Continue to team', onClick: handleNextStep, disabled: false, loading: false }
      case 3:
        return { label: 'Continue to posting', onClick: handleNextStep, disabled: false, loading: false }
      case 4:
        return { label: 'Continue to review', onClick: handlePostingContinue, disabled: isSubmitting, loading: isSubmitting }
      case 5:
      default:
        return {
          label: wizardState.hasPosting ? 'Create & publish' : 'Create job (internal)',
          onClick: handleComplete,
          disabled: false,
          loading: false,
        }
    }
  })()

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[1080px] p-0 bg-[#F6F5F1] border-l border-virgilio-border"
      >
        <div className="flex h-full flex-col">

          {/* Header */}
          <div className="px-6 sm:px-10 pt-1 pb-6">
            <p className="text-[11px] font-poppins font-semibold uppercase tracking-[0.14em] text-virgilio-purple">
              {meta.eyebrow}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[28px] sm:text-[34px] leading-tight">
                {meta.title}
                <span className="text-virgilio-purple">.</span>
              </h1>
              {meta.ai && <AiAssistedBadge />}
            </div>
            <p className="mt-2 max-w-xl text-[13.5px] text-text-secondary leading-snug">
              {meta.subtitle}
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            {/* Left rail */}
            <aside className="hidden md:flex w-[260px] shrink-0 flex-col gap-2 px-6 lg:px-10 pb-6">
              <ol className="space-y-1">
                {STEPS.map((step) => {
                  const isActive = wizardState.currentStep === step.id
                  const isCompleted =
                    wizardState.currentStep > step.id ||
                    (step.id === 1 && !!wizardState.createdJobId)
                  const isAccessible = step.id <= wizardState.currentStep || isCompleted
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() =>
                          isAccessible &&
                          step.id !== wizardState.currentStep &&
                          setWizardState((prev) => ({ ...prev, currentStep: step.id }))
                        }
                        disabled={!isAccessible}
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                          isActive
                            ? 'bg-white border border-virgilio-border shadow-sm'
                            : 'hover:bg-white/60',
                          !isAccessible && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-poppins font-semibold transition-colors',
                            isCompleted
                              ? 'bg-virgilio-purple text-white'
                              : isActive
                              ? 'bg-[#0d0d09] text-white'
                              : 'bg-virgilio-border text-text-tertiary'
                          )}
                        >
                          {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.id}
                        </span>
                        <span
                          className={cn(
                            'text-[13px] font-poppins font-medium',
                            isActive ? 'text-text-primary' : 'text-text-secondary'
                          )}
                        >
                          {step.title}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              <div className="mt-4 rounded-xl bg-[#F2EBFF] p-4">
                <p className="text-[10.5px] font-poppins font-semibold uppercase tracking-[0.12em] text-virgilio-purple">
                  Auto-saved as draft
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
                  Close any time — resume from Jobs → Drafts.
                </p>
              </div>
            </aside>

            {/* Main content */}
            <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 pb-8">
              <div ref={stepRef}>{renderStepContent()}</div>
            </main>

          </div>

          {/* Sticky footer */}
          {showFooter && (
            <div className="border-t border-virgilio-border bg-[#F6F5F1]/95 backdrop-blur px-6 sm:px-10 py-4">
              {publishError && (
                <p role="alert" className="mb-3 text-[12px] font-inter text-destructive">{publishError}</p>
              )}
              <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {saveStatusText && (
                  <span className="hidden sm:inline font-inter text-[11.5px] text-[#8B8F9E] min-w-[110px]" aria-live="polite">
                    {/* §12 autosave: each status crossfades in over 150ms. */}
                    <span key={saveStatusText} className="gio-autosave-label">{saveStatusText}</span>
                  </span>
                )}
                {wizardState.currentStep === 1 ? (
                  <Button variant="ghost" onClick={onClose} type="button">
                    Cancel
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={handlePrevStep} type="button" icon={ChevronLeft}>
                    Back
                  </Button>
                )}
                <Button
                  variant="secondary"
                  type="button"
                  onClick={handleSaveAndExit}
                  disabled={isSubmitting}
                >
                  Save &amp; exit
                </Button>
                <p className="hidden xl:block text-[12px] text-text-tertiary">
                  {wizardState.currentStep === 1 ? (
                    <>Required fields marked with <span className="text-destructive">*</span></>
                  ) : wizardState.currentStep === 4 ? (
                    <>Posting to <span className="text-text-primary font-medium">{postingMeta.channels} channels</span> · application form <span className="text-text-primary font-medium">{postingMeta.fields} fields</span></>
                  ) : null}
                </p>
                {wizardState.currentStep === 4 && (
                  <button
                    type="button"
                    onClick={handlePostingSkip}
                    className="text-[12px] text-text-secondary hover:text-text-primary underline underline-offset-2"
                  >
                    Skip — I'll create the posting later
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={primaryCta.onClick}
                  iconRight={ChevronRight}
                  disabled={primaryCta.disabled}
                  loading={primaryCta.loading}
                >
                  {primaryCta.label}
                </Button>
              </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
