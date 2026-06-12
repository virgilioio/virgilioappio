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
    <section className="bg-white border border-[#E7E8EE] rounded-[14px] shadow-[0_1px_2px_rgba(13,13,9,0.04)] p-4">
      <h3 className="font-inter font-semibold text-[10.5px] uppercase tracking-[0.08em] text-[#8B8F9E] mb-3">
        Quick actions
      </h3>
      <div className="space-y-2">
        {nextStageLabel && !isRejected && !isHired && (
          <Button variant="primary" size="md" iconRight={ArrowRight} onClick={onAdvance} className="w-full justify-center">
            Advance to {nextStageLabel}
          </Button>
        )}
        {!isRejected && !isHired && (
          <Button variant="secondary" size="md" icon={ClipboardCheck} onClick={onSubmitScorecard} className="w-full justify-center">
            Submit scorecard
          </Button>
        )}
        <Button variant="secondary" size="md" icon={ArrowLeftRight} onClick={onAddTransfer} className="w-full justify-center">
          Add/Transfer to job
        </Button>
        {!isRejected && !isHired && (
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
