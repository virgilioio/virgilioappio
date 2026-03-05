import { Card, CardContent } from '@/components/ui/card'
import { ClipboardCheck } from 'lucide-react'

interface CandidateOfferApprovalsProps {
  candidateId: string
  jobId: string
  organizationId?: string | null
}

export function CandidateOfferApprovals({ candidateId, jobId, organizationId }: CandidateOfferApprovalsProps) {
  return (
    <Card className="bg-surface-primary border-border">
      <CardContent className="py-12">
        <div className="text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-virgilio-purple/10 mx-auto">
            <ClipboardCheck className="h-8 w-8 text-virgilio-purple" />
          </div>
          <p className="text-[1.38rem] font-semibold mb-2 tracking-[-0.06em]">
            <span>No approval chain configured</span>
            <span className="text-purple-period">.</span>
          </p>
          <p className="text-sm text-text-secondary">
            Configure an offer approval chain in Job Setup → Hiring Team to see approval status here.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
