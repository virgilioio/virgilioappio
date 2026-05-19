import { ArrowRight, ClipboardCheck, ArrowLeftRight, FileText, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProfileQuickActionsCardProps {
  nextStageLabel?: string | null
  onAdvance?: () => void
  onSubmitScorecard?: () => void
  onAddTransfer?: () => void
  onCreateOffer?: () => void
  onReject?: () => void
  isOfferStatus?: boolean
  isRejected?: boolean
  isHired?: boolean
}

export function ProfileQuickActionsCard({
  nextStageLabel, onAdvance, onSubmitScorecard, onAddTransfer, onCreateOffer, onReject,
  isOfferStatus, isRejected, isHired,
}: ProfileQuickActionsCardProps) {
  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm p-5">
      <h3 className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-text-tertiary mb-3">
        Quick actions
      </h3>
      <div className="space-y-2">
        {nextStageLabel && !isRejected && !isHired && (
          <Button variant="primary" size="md" iconRight={ArrowRight} onClick={onAdvance} className="w-full justify-center">
            Advance to {nextStageLabel}
          </Button>
        )}
        <Button variant="secondary" size="md" icon={ClipboardCheck} onClick={onSubmitScorecard} className="w-full justify-center">
          Submit scorecard
        </Button>
        <Button variant="secondary" size="md" icon={ArrowLeftRight} onClick={onAddTransfer} className="w-full justify-center">
          Add/Transfer to job
        </Button>
        {isOfferStatus && (
          <Button variant="purple" size="md" icon={FileText} onClick={onCreateOffer} className="w-full justify-center">
            Create offer
          </Button>
        )}
        {!isRejected && !isHired && (
          <Button variant="danger" size="md" icon={ThumbsDown} onClick={onReject} className="w-full justify-center">
            Reject candidate
          </Button>
        )}
      </div>
    </section>
  )
}

export default ProfileQuickActionsCard
