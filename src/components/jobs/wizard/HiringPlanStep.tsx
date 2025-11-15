import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HiringPlanTab } from '../HiringPlanTab'

interface HiringPlanStepProps {
  jobId: string | null
  onNext: () => void
  onBack: () => void
}

export function HiringPlanStep({ jobId, onNext, onBack }: HiringPlanStepProps) {
  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">Job must be created before configuring hiring plan.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-text-primary mb-2">Configure Hiring Stages</h3>
        <p className="text-sm text-text-secondary">
          Set up the stages candidates will progress through during the hiring process.
        </p>
      </div>

      <div className="border border-border rounded-lg p-6">
        <HiringPlanTab jobId={jobId} hideHeader={true} />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={onBack}
          type="button"
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        <Button
          onClick={onNext}
          type="button"
          className="flex items-center gap-2"
        >
          Continue to Team
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}