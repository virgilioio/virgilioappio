import { useState } from 'react'
import { CreateWorkerData } from '@/hooks/useWorkers'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PersonalDetailsStep } from './PersonalDetailsStep'
import { JobDetailsStep } from './JobDetailsStep'
import { CompensationDatesStep } from './CompensationDatesStep'
import { ReviewStep } from './ReviewStep'

interface WorkerDetailsWizardProps {
  onSubmit: (data: CreateWorkerData) => void
  onCancel: () => void
  prefilledData?: Partial<CreateWorkerData>
  workerType: 'employee' | 'contractor'
  contractorPaymentType?: 'fixed_rate' | 'hourly_rate' | 'per_project'
}

export function WorkerDetailsWizard({ 
  onSubmit, 
  onCancel, 
  prefilledData = {}, 
  workerType, 
  contractorPaymentType 
}: WorkerDetailsWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<CreateWorkerData>>({
    ...prefilledData,
    worker_type: workerType,
    contractor_payment_type: contractorPaymentType,
    worker_status: 'pending',
    currency: 'USD',
    payment_period: 'monthly',
    employment_terms: 'indefinite'
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const totalSteps = 4

  const stepConfig = [
    {
      number: 1,
      title: 'Personal Details',
      description: 'Legal information and contact details'
    },
    {
      number: 2,
      title: 'Job Details',
      description: 'Workplace and organizational information'
    },
    {
      number: 3,
      title: 'Compensation & Dates',
      description: 'Salary, payment terms, and agreement dates'
    },
    {
      number: 4,
      title: 'Review',
      description: 'Review all information before creation'
    }
  ]

  const getStepTitle = () => {
    return stepConfig[currentStep - 1]?.title || 'Worker Details'
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1:
        if (!formData.legal_first_name?.trim()) {
          newErrors.legal_first_name = 'Legal first name is required'
        }
        if (!formData.legal_last_name?.trim()) {
          newErrors.legal_last_name = 'Legal last name is required'
        }
        if (!formData.country?.trim()) {
          newErrors.country = 'Country of residence is required'
        }
        if (!formData.personal_email?.trim()) {
          newErrors.personal_email = 'Personal email is required'
        }
        if (!formData.personal_phone?.trim()) {
          newErrors.personal_phone = 'Personal phone number is required'
        }
        break
      case 2:
        // Worker ID is auto-generated, so no validation needed
        break
      case 3:
        if (!formData.currency?.trim()) {
          newErrors.currency = 'Currency is required'
        }
        if (!formData.payment_period?.trim()) {
          newErrors.payment_period = 'Payment period is required'
        }
        if (!formData.start_date?.trim()) {
          newErrors.start_date = 'Agreement start date is required'
        }
        if (!formData.employment_terms?.trim()) {
          newErrors.employment_terms = 'Employment terms are required'
        }
        
        // Contractor-specific validations
        if (workerType === 'contractor') {
          if (contractorPaymentType === 'hourly_rate' && !formData.hourly_rate) {
            newErrors.hourly_rate = 'Hourly rate is required'
          }
          if (contractorPaymentType === 'fixed_rate' && !formData.monthly_fixed_amount) {
            newErrors.monthly_fixed_amount = 'Monthly fixed amount is required'
          }
        } else {
          // Employee-specific validations
          if (formData.base_salary && formData.base_salary <= 0) {
            newErrors.base_salary = 'Base salary must be greater than 0'
          }
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1)
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      // Ensure we have all required fields
      const finalData: CreateWorkerData = {
        organization_id: formData.organization_id || '',
        full_name: `${formData.legal_first_name} ${formData.legal_last_name}`,
        legal_first_name: formData.legal_first_name || '',
        legal_last_name: formData.legal_last_name || '',
        citizenship: formData.citizenship || '',
        personal_email: formData.personal_email || '',
        work_email: formData.work_email || '',
        personal_phone: formData.personal_phone || '',
        worker_status: formData.worker_status || 'pending',
        worker_type: workerType,
        job_title: formData.job_title || '',
        seniority_level: formData.seniority_level,
        working_location: formData.working_location || '',
        scope_of_work: formData.scope_of_work || '',
        manager_id: formData.manager_id,
        reports: formData.reports || [],
        department: formData.department || '',
        currency: formData.currency || 'USD',
        base_salary: formData.base_salary,
        payment_period: formData.payment_period || 'monthly',
        employment_terms: formData.employment_terms || 'indefinite',
        start_date: formData.start_date || '',
        end_date: formData.end_date || '',
        country: formData.country || '',
        contractor_payment_type: contractorPaymentType,
        hourly_rate: formData.hourly_rate,
        monthly_fixed_amount: formData.monthly_fixed_amount,
        project_details: formData.project_details || ''
      }

      onSubmit(finalData)
    }
  }

  const updateFormData = (stepData: Partial<CreateWorkerData>) => {
    setFormData(prev => ({ ...prev, ...stepData }))
    setErrors({})
  }

  const renderCurrentStep = () => {
    const stepProps = {
      data: formData,
      errors,
      onUpdate: updateFormData,
      workerType,
      contractorPaymentType
    }

    switch (currentStep) {
      case 1:
        return <PersonalDetailsStep {...stepProps} />
      case 2:
        return <JobDetailsStep {...stepProps} />
      case 3:
        return <CompensationDatesStep {...stepProps} />
      case 4:
        return <ReviewStep {...stepProps} />
      default:
        return null
    }
  }

  return (
    <div className="relative">
      {/* Floating Step Indicator */}
      <div className="absolute right-0 top-0 w-64 p-4 bg-white rounded-lg border shadow-sm animate-fade-in">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Progress</h3>
        <div className="space-y-3">
          {stepConfig.map((step, index) => {
            const isCompleted = step.number < currentStep
            const isCurrent = step.number === currentStep
            const isUpcoming = step.number > currentStep
            
            return (
              <div
                key={step.number}
                className={`flex items-start gap-3 p-2 rounded-md transition-all duration-300 ${
                  isCurrent ? 'bg-[#d7c5fb] border border-[#c9b3f7]' : ''
                }`}
              >
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-[#9b7df7] text-white animate-pulse'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? '✓' : step.number}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium transition-colors duration-300 ${
                      isCurrent
                        ? 'text-[#7c3aed]'
                        : isCompleted
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p
                    className={`text-xs transition-colors duration-300 ${
                      isCurrent
                        ? 'text-[#7c3aed]/80'
                        : isCompleted
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/70'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="pr-72">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-1 h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>{getStepTitle()}</DialogTitle>
          </div>
          
          {/* Horizontal Step indicator */}
          <div className="flex gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, index) => {
              const step = index + 1
              return (
                <div
                  key={step}
                  className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                    step <= currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )
            })}
          </div>
          
          {/* Step counter */}
          <div className="text-sm text-muted-foreground text-center">
            Step {currentStep} of {totalSteps}
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {renderCurrentStep()}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onCancel : handleBack}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep < totalSteps ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit}>
              Create Worker
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}