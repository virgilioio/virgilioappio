import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HiringTeamTab } from '../HiringTeamTab'

interface HiringTeamStepProps {
  jobId: string | null
  onNext: () => void
  onBack: () => void
}

export function HiringTeamStep({ jobId, onNext, onBack }: HiringTeamStepProps) {
  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">Job must be created before assigning team members.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-text-primary mb-2">Assign Hiring Team</h3>
        <p className="text-sm text-text-secondary">
          Add team members who will have access to this job and its candidates.
        </p>
      </div>

      <div className="border border-border rounded-lg">
        <HiringTeamTab jobId={jobId} jobTitle="New Job" />
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
          Review & Finish
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}