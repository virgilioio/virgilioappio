import React, { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJobs, CreateJobData } from '@/hooks/useJobs'
import { toast } from '@/hooks/use-toast'
import { JobInfoStep } from './wizard/JobInfoStep'
import { HiringPlanStep } from './wizard/HiringPlanStep'
import { HiringTeamStep } from './wizard/HiringTeamStep'
import { SummaryStep } from './wizard/SummaryStep'

interface JobWizardProps {
  isOpen: boolean
  onClose: () => void
}

interface WizardState {
  currentStep: number
  isComplete: boolean
  createdJobId: string | null
  jobData: Partial<CreateJobData>
}

const STEPS = [
  { id: 1, title: 'Job Information', description: 'Basic job details' },
  { id: 2, title: 'Hiring Plan', description: 'Configure stages' },
  { id: 3, title: 'Hiring Team', description: 'Assign team members' },
  { id: 4, title: 'Summary', description: 'Review and create' }
]

export function JobWizard({ isOpen, onClose }: JobWizardProps) {
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 1,
    isComplete: false,
    createdJobId: null,
    jobData: {
      status: 'draft'
    }
  })

  const { createJob, isLoading } = useJobs()

  const resetWizard = () => {
    setWizardState({
      currentStep: 1,
      isComplete: false,
      createdJobId: null,
      jobData: {
        status: 'draft'
      }
    })
  }

  useEffect(() => {
    if (!isOpen) {
      resetWizard()
    }
  }, [isOpen])

  const updateJobData = (data: Partial<CreateJobData>) => {
    setWizardState(prev => ({
      ...prev,
      jobData: { ...prev.jobData, ...data }
    }))
  }

  const handleNextStep = async () => {
    // If completing step 1, create the job with basic information
    if (wizardState.currentStep === 1) {
      try {
        const jobResult = await createJob(wizardState.jobData as CreateJobData)
        setWizardState(prev => ({
          ...prev,
          createdJobId: (jobResult as any)?.id || 'created',
          currentStep: prev.currentStep + 1
        }))
        toast({
          title: 'Job Created',
          description: 'Basic job information saved. Continue to configure hiring plan.'
        })
      } catch (error) {
        console.error('Error creating job:', error)
        // Don't advance step if job creation fails
        return
      }
    } else {
      setWizardState(prev => ({
        ...prev,
        currentStep: Math.min(prev.currentStep + 1, STEPS.length)
      }))
    }
  }

  const handlePrevStep = () => {
    setWizardState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1)
    }))
  }

  const handleComplete = () => {
    setWizardState(prev => ({ ...prev, isComplete: true }))
    toast({
      title: 'Job Created Successfully!',
      description: 'Your job has been created and is ready for candidates.'
    })
    onClose()
  }

  const canProceedToNextStep = () => {
    switch (wizardState.currentStep) {
      case 1:
        return wizardState.jobData.title && wizardState.jobData.organization_id
      case 2:
      case 3:
        return wizardState.createdJobId
      case 4:
        return true
      default:
        return false
    }
  }

  const renderStepContent = () => {
    switch (wizardState.currentStep) {
      case 1:
        return (
          <JobInfoStep
            jobData={wizardState.jobData}
            onUpdate={updateJobData}
          />
        )
      case 2:
        return (
          <HiringPlanStep
            jobId={wizardState.createdJobId}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        )
      case 3:
        return (
          <HiringTeamStep
            jobId={wizardState.createdJobId}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        )
      case 4:
        return (
          <SummaryStep
            jobData={wizardState.jobData}
            jobId={wizardState.createdJobId}
            onComplete={handleComplete}
            onBack={handlePrevStep}
          />
        )
      default:
        return null
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-[900px] h-full p-0">
        <div className="flex h-full">
          {/* Steps Navigation */}
          <div className="w-64 bg-background border-r border-border p-6 flex flex-col">
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-text-primary">Create New Job</h2>
              <p className="text-sm text-text-secondary mt-1">Follow the steps to create your job posting</p>
            </div>

            <div className="space-y-4 flex-1">
              {STEPS.map((step) => {
                const isActive = wizardState.currentStep === step.id
                const isCompleted = wizardState.currentStep > step.id || (step.id === 1 && wizardState.createdJobId)
                const isAccessible = step.id <= wizardState.currentStep || isCompleted

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors",
                      isActive && "bg-accent",
                      !isAccessible && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => {
                      if (isAccessible && step.id !== wizardState.currentStep) {
                        setWizardState(prev => ({ ...prev, currentStep: step.id }))
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        isActive ? "text-text-primary" : "text-text-secondary"
                      )}>
                        {step.title}
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <SheetHeader className="px-6 py-4 border-b border-border">
              <SheetTitle className="text-lg">
                {STEPS.find(s => s.id === wizardState.currentStep)?.title}
              </SheetTitle>
              <SheetDescription>
                {STEPS.find(s => s.id === wizardState.currentStep)?.description}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {renderStepContent()}
            </div>

            {/* Navigation Footer - Only show for steps 1 and 4 */}
            {(wizardState.currentStep === 1 || wizardState.currentStep === 4) && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </Button>

                <div className="flex items-center gap-2">
                  {wizardState.currentStep > 1 && wizardState.currentStep !== 4 && (
                    <Button
                      variant="outline"
                      onClick={handlePrevStep}
                      type="button"
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </Button>
                  )}

                  {wizardState.currentStep === 1 && (
                    <Button
                      onClick={handleNextStep}
                      disabled={!canProceedToNextStep() || isLoading}
                      type="button"
                      className="flex items-center gap-2"
                    >
                      {isLoading ? 'Creating...' : 'Create & Continue'}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}