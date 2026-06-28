import React, { useState, useEffect } from 'react'
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

interface JobWizardProps {
  isOpen: boolean
  onClose: () => void
  initialData?: Partial<CreateJobData> & { sourceJobTitle?: string }
}

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

export function JobWizard({ isOpen, onClose, initialData }: JobWizardProps) {
  const seedData = (): Partial<CreateJobData> => {
    if (!initialData) return { status: 'draft' }
    const { sourceJobTitle, ...rest } = initialData as any
    return { status: 'draft', ...rest }
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
  const { ensureProject: ensureSourcingProject } = useJobSourcingProject(
    wizardState.createdJobId && wizardState.createdJobId !== 'created'
      ? wizardState.createdJobId
      : null,
  )

  // Reset scroll position on step change — UX: always start at top of new step.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [wizardState.currentStep])


  const resetWizard = () =>
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
    if (!isOpen) resetWizard()
    else if (initialData) {
      // Re-seed when opening with new initialData
      setWizardState((prev) => ({ ...prev, jobData: seedData() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const updateJobData = (data: Partial<CreateJobData>) =>
    setWizardState((prev) => ({ ...prev, jobData: { ...prev.jobData, ...data } }))

  const submitStep1 = async (): Promise<{ id: string; created: boolean } | null> => {
    if (isSubmitting) return null
    setIsSubmitting(true)
    try {
      // Default status to 'open' when the user completes the wizard through
      // Step 1 — they clearly intend the job to be live. Explicit Draft/Closed
      // selections from JobInfoStep are respected.
      const payload = {
        ...wizardState.jobData,
        status: wizardState.jobData.status ?? 'open',
      } as CreateJobData
      const existingId = wizardState.createdJobId
      if (existingId && existingId !== 'created') {
        // Re-entering step 1 after the job was already created — update in place
        // instead of inserting a duplicate row.
        await updateJob(existingId, payload as any)
        return { id: existingId, created: false }
      }
      const jobResult = await createJob(payload)
      const id = (jobResult as any)?.id || 'created'
      setWizardState((prev) => ({ ...prev, createdJobId: id }))
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
    if (wizardState.currentStep === 1 && !wizardState.createdJobId) {
      const r = await submitStep1()
      if (!r) return
    }
    toast({ title: 'Saved as draft', description: 'You can resume from Jobs → Drafts.' })
    onClose()
  }

  const handleComplete = async () => {
    setWizardState((prev) => ({ ...prev, isComplete: true }))
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
      description: 'Your job has been created and is ready for candidates.',
    })
    if (wizardState.createdJobId && wizardState.createdJobId !== 'created') {
      window.open(`/jobs/${wizardState.createdJobId}`, '_blank')
    }
    onClose()
  }

  const canProceedStep1 = () =>
    !!wizardState.jobData.title && !!wizardState.jobData.organization_id && !!wizardState.jobData.department_id

  const handlePostingContinue = async () => {
    setIsSubmitting(true)
    try {
      const ok = await postingRef.current?.savePosting()
      if (ok === false) return
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
            <JobInfoStep jobData={wizardState.jobData} onUpdate={updateJobData} />
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
            jobData={wizardState.jobData}
            jobId={wizardState.createdJobId}
            hasPosting={wizardState.hasPosting}
            postingMeta={postingMeta}
            onGoToStep={goToStep}
            autoSource={autoSource}
            onAutoSourceChange={setAutoSource}
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
        return { label: 'Create & continue', onClick: handleNextStep, disabled: !canProceedStep1() || isSubmitting, loading: isSubmitting }
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
              {renderStepContent()}
            </main>

          </div>

          {/* Sticky footer */}
          {showFooter && (
            <div className="border-t border-virgilio-border bg-[#F6F5F1]/95 backdrop-blur px-6 sm:px-10 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {wizardState.currentStep === 1 ? (
                  <Button variant="ghost" onClick={onClose} type="button">
                    Cancel
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={handlePrevStep} type="button" icon={ChevronLeft}>
                    Back
                  </Button>
                )}
                <p className="hidden sm:block text-[12px] text-text-tertiary">
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
                  variant="secondary"
                  type="button"
                  onClick={handleSaveAndExit}
                  disabled={isSubmitting}
                >
                  Save and exit
                </Button>
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
