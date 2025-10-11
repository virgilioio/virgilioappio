import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Download, ThumbsDown, CheckCircle2 } from 'lucide-react'
import MoveToPipelineMenu from '@/components/candidates/MoveToPipelineMenu'
import { JobStage } from '@/hooks/useJobHiringPlan'

interface CandidateControlsCardProps {
  // Status & Association
  associationId: string | null
  associationStatus: 'active' | 'rejected' | 'hired' | 'offer' | null
  currentStageId: string | null
  
  // Candidate & Job data
  candidateId: string | null
  jobId: string
  candidate: any
  job: any
  planStages: { jhsId: string; stage: JobStage; position: number }[]
  
  // Action handlers
  onReject: () => void
  onMarkHired: () => void
  onDownloadPdf: () => void
}

export function CandidateControlsCard({
  associationId,
  associationStatus,
  currentStageId,
  candidateId,
  jobId,
  planStages,
  onReject,
  onMarkHired,
  onDownloadPdf,
}: CandidateControlsCardProps) {
  const canMarkHired = !!associationId && 
    associationStatus !== 'hired' && 
    (associationStatus === 'offer' || 
     planStages.find(s => s.jhsId === currentStageId)?.stage.stage_type === 'offer')
  
  const showReject = associationId && associationStatus !== 'rejected'
  const showMoveToPipeline = !associationId && jobId && candidateId

  return (
    <Card className="bg-white border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left side - Primary actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {showReject && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onReject}
                className="gap-2"
              >
                <ThumbsDown className="h-4 w-4" />
                Reject
              </Button>
            )}
            
            {canMarkHired && (
              <Button
                variant="default"
                size="sm"
                onClick={onMarkHired}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Hired
              </Button>
            )}
            
            {showMoveToPipeline && (
              <MoveToPipelineMenu
                jobId={jobId}
                candidateId={candidateId}
                buttonText="Move to pipeline"
              />
            )}
          </div>
          
          {/* Right side - Secondary actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadPdf}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
