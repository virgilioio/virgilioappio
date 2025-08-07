import { JobAssignmentsPanel } from './JobAssignmentsPanel'

interface HiringTeamTabProps {
  jobId: string
  jobTitle: string
}

export function HiringTeamTab({ jobId, jobTitle }: HiringTeamTabProps) {
  return (
    <div>
      <JobAssignmentsPanel jobId={jobId} jobTitle={jobTitle} />
    </div>
  )
}