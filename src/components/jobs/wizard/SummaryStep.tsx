import React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, CheckCircle } from 'lucide-react'
import { CreateJobData } from '@/hooks/useJobs'
import { useOrganizations } from '@/hooks/useOrganizations'

interface SummaryStepProps {
  jobData: Partial<CreateJobData>
  jobId: string | null
  onComplete: () => void
  onBack: () => void
}

export function SummaryStep({ jobData, jobId, onComplete, onBack }: SummaryStepProps) {
  const { organizations } = useOrganizations()
  
  const organization = organizations.find(org => org.id === jobData.organization_id)
  const formatSalary = (min?: number, max?: number, currency?: string) => {
    if (!min && !max) return 'Not specified'
    if (min && max) return `${currency || 'USD'} ${min.toLocaleString()} - ${max.toLocaleString()}`
    if (min) return `${currency || 'USD'} ${min.toLocaleString()}+`
    if (max) return `Up to ${currency || 'USD'} ${max.toLocaleString()}`
    return 'Not specified'
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-text-primary mb-2">Job Creation Summary</h3>
        <p className="text-sm text-text-secondary">
          Review your job details before finalizing. You can always edit these later.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-xl font-semibold text-text-primary">{jobData.title || 'Untitled Job'}</h4>
            <p className="text-sm text-text-secondary mt-1">{organization?.name || 'Unknown Organization'}</p>
          </div>
          <Badge variant={jobData.status === 'open' ? 'default' : 'secondary'}>
            {jobData.status || 'draft'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <h5 className="text-sm font-medium text-text-primary mb-2">Department</h5>
            <p className="text-sm text-text-secondary">{jobData.department || 'Not specified'}</p>
          </div>
          <div>
            <h5 className="text-sm font-medium text-text-primary mb-2">Location</h5>
            <p className="text-sm text-text-secondary">{jobData.location || 'Not specified'}</p>
          </div>
          <div className="col-span-2">
            <h5 className="text-sm font-medium text-text-primary mb-2">Salary Range</h5>
            <p className="text-sm text-text-secondary">
              {formatSalary(jobData.salary_min, jobData.salary_max, jobData.currency)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-primary" />
            <h5 className="font-medium text-text-primary">Hiring Plan</h5>
          </div>
          <p className="text-sm text-text-secondary">
            Hiring stages have been configured and are ready for candidates.
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-primary" />
            <h5 className="font-medium text-text-primary">Hiring Team</h5>
          </div>
          <p className="text-sm text-text-secondary">
            Team members have been assigned and will have access to this job.
          </p>
        </Card>
      </div>

      <div className="p-4 bg-accent rounded-lg">
        <h5 className="font-medium text-text-primary mb-2">🎉 Your job is ready!</h5>
        <p className="text-sm text-text-secondary">
          Your job has been created successfully. You can now start adding candidates, create job postings, 
          and manage your hiring process.
        </p>
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
          onClick={onComplete}
          type="button"
          className="flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Complete Job Creation
        </Button>
      </div>
    </div>
  )
}