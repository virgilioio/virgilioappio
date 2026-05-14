import { ArrowRight, ClipboardCheck, Calendar, Mail, FileText, ThumbsDown, MoreHorizontal, Edit, Download, RotateCcw, Check as CheckIcon, ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

interface ProfileActionBarProps {
  nextStageLabel?: string | null
  onAdvance?: () => void
  onSubmitScorecard?: () => void
  onSchedule?: () => void
  onEmail?: () => void
  onCreateOffer?: () => void
  onReject?: () => void
  isOfferStatus?: boolean
  isRejected?: boolean
  isHired?: boolean
  // Overflow
  onEdit?: () => void
  onDownload?: () => void
  onMoveToOffer?: () => void
  onReturnToPipeline?: () => void
  onHire?: () => void
  onAddOrTransfer?: () => void
  canEdit?: boolean
}

export function ProfileActionBar({
  nextStageLabel, onAdvance, onSubmitScorecard, onSchedule, onEmail,
  onCreateOffer, onReject, isOfferStatus, isRejected, isHired,
  onEdit, onDownload, onMoveToOffer, onReturnToPipeline, onHire, canEdit,
}: ProfileActionBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        {nextStageLabel && !isRejected && !isHired && (
          <Button variant="primary" size="md" iconRight={ArrowRight} onClick={onAdvance}>
            Advance to {nextStageLabel}
          </Button>
        )}
        <Button variant="secondary" size="md" icon={ClipboardCheck} onClick={onSubmitScorecard}>
          Submit scorecard
        </Button>
        <Button variant="secondary" size="md" icon={Calendar} onClick={onSchedule}>
          Schedule
        </Button>
        <Button variant="secondary" size="md" icon={Mail} onClick={onEmail}>
          Email
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {isOfferStatus && (
          <Button variant="purple" size="md" icon={FileText} onClick={onCreateOffer}>
            Create offer letter
          </Button>
        )}
        {!isRejected && !isHired && (
          <Button variant="danger" size="md" icon={ThumbsDown} onClick={onReject}>
            Reject
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="md" iconOnly aria-label="More actions" icon={MoreHorizontal} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canEdit && onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" /> Edit candidate
              </DropdownMenuItem>
            )}
            {onDownload && (
              <DropdownMenuItem onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" /> Download profile
              </DropdownMenuItem>
            )}
            {!isOfferStatus && !isRejected && !isHired && onMoveToOffer && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onMoveToOffer}>
                  <ArrowRight className="h-4 w-4 mr-2" /> Move to offer
                </DropdownMenuItem>
              </>
            )}
            {isOfferStatus && onReturnToPipeline && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onReturnToPipeline}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Return to pipeline
                </DropdownMenuItem>
              </>
            )}
            {isOfferStatus && onHire && (
              <DropdownMenuItem onClick={onHire}>
                <CheckIcon className="h-4 w-4 mr-2" /> Mark as hired
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default ProfileActionBar
