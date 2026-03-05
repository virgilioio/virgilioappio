import { JobAssignmentsPanel } from './JobAssignmentsPanel'
import { OfferApprovalChainConfig } from './OfferApprovalChainConfig'

interface HiringTeamTabProps {
  jobId: string
  jobTitle: string
}

export function HiringTeamTab({ jobId, jobTitle }: HiringTeamTabProps) {
  return (
    <div className="space-y-10">
      <JobAssignmentsPanel jobId={jobId} jobTitle={jobTitle} />
      <OfferApprovalChainConfig jobId={jobId} jobTitle={jobTitle} />
    </div>
  )
}