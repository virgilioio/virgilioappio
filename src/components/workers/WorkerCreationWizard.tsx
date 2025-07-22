import { useState } from 'react'
import { WorkerTypeSelection } from './WorkerTypeSelection'
import { ContractorPaymentSelection } from './ContractorPaymentSelection'
import { WorkerDetailsWizard } from './WorkerDetailsWizard'
import { CreateWorkerData } from '@/hooks/useWorkers'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

type WorkerType = 'employee' | 'contractor'
type ContractorPaymentType = 'fixed_rate' | 'hourly_rate' | 'per_project'

interface WorkerCreationWizardProps {
  onSubmit: (data: CreateWorkerData) => void
  onCancel: () => void
  onStepChange?: (step: number) => void
}

interface WizardData {
  workerType?: WorkerType
  contractorPaymentType?: ContractorPaymentType
  formData?: Partial<CreateWorkerData>
}

export function WorkerCreationWizard({ onSubmit, onCancel, onStepChange }: WorkerCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardData>({})

  const handleWorkerTypeSelect = (type: WorkerType) => {
    setWizardData(prev => ({ ...prev, workerType: type }))
    
    if (type === 'employee') {
      // Go directly to form for employees
      setCurrentStep(3)
      onStepChange?.(3)
    } else {
      // Go to contractor payment selection
      setCurrentStep(2)
      onStepChange?.(2)
    }
  }

  const handleContractorPaymentSelect = (paymentType: ContractorPaymentType) => {
    setWizardData(prev => ({ ...prev, contractorPaymentType: paymentType }))
    setCurrentStep(3)
    onStepChange?.(3)
  }

  const handleFormSubmit = (formData: CreateWorkerData) => {
    // Merge wizard selections with form data
    const finalData: CreateWorkerData = {
      ...formData,
      worker_type: wizardData.workerType as any, // Will be updated to new enum values
      contractor_payment_type: wizardData.contractorPaymentType as any,
      // Set default payment structure based on selections
      ...(wizardData.contractorPaymentType === 'fixed_rate' && {
        monthly_fixed_amount: 0 // Will be filled in form
      }),
      ...(wizardData.contractorPaymentType === 'hourly_rate' && {
        hourly_rate: 0 // Will be filled in form
      }),
      ...(wizardData.contractorPaymentType === 'per_project' && {
        project_details: '' // Will be filled in form
      })
    }
    
    onSubmit(finalData)
  }

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1)
      onStepChange?.(1)
    } else if (currentStep === 3) {
      if (wizardData.workerType === 'employee') {
        setCurrentStep(1)
        onStepChange?.(1)
      } else {
        setCurrentStep(2)
        onStepChange?.(2)
      }
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Choose Worker Type'
      case 2:
        return 'Choose Payment Structure'
      case 3:
        return 'Worker Details'
      default:
        return 'Add New Worker'
    }
  }

  // Pre-fill form data based on wizard selections
  const getPrefilledFormData = (): Partial<CreateWorkerData> => {
    const baseData: Partial<CreateWorkerData> = {
      worker_type: wizardData.workerType as any,
      worker_status: 'pending',
      currency: 'USD',
      payment_frequency: 'monthly'
    }

    if (wizardData.workerType === 'contractor') {
      baseData.contractor_payment_type = wizardData.contractorPaymentType as any
      baseData.contract_type = 'freelance'
    } else {
      baseData.contract_type = 'permanent'
    }

    return baseData
  }

  return (
    <>
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
        {/* Step indicator */}
        <div className="flex gap-2 mt-4">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full ${
                step <= currentStep ? 'bg-primary' : 'bg-muted'
              } ${step === 2 && wizardData.workerType === 'employee' ? 'opacity-30' : ''}`}
            />
          ))}
        </div>
      </DialogHeader>

      <div className="mt-6">
        {currentStep === 1 && (
          <WorkerTypeSelection onSelect={handleWorkerTypeSelect} />
        )}

        {currentStep === 2 && (
          <ContractorPaymentSelection onSelect={handleContractorPaymentSelect} />
        )}

        {currentStep === 3 && (
          <WorkerDetailsWizard
            onSubmit={handleFormSubmit}
            onCancel={onCancel}
            prefilledData={getPrefilledFormData()}
            workerType={wizardData.workerType!}
            contractorPaymentType={wizardData.contractorPaymentType}
          />
        )}
      </div>
    </>
  )
}