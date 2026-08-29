import { ArrowRight, ClipboardCheck, ArrowLeftRight, FileText, ThumbsDown, CheckCircle2, Lock, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/usePermissions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ProfileQuickActionsCardProps {
  nextStageLabel?: string | null
  onAdvance?: () => void
  onSubmitScorecard?: () => void
  onRequestReferences?: () => void
  onAddTransfer?: () => void
  onCreateOffer?: () => void
  onReject?: () => void
  isOfferStatus?: boolean
  isRejected?: boolean
  isHired?: boolean
  onMarkHired?: () => void
  canMarkHired?: boolean
  markHiredHelper?: string
  canOverride?: boolean
  onOverrideRelease?: () => void
}

export function ProfileQuickActionsCard({
  nextStageLabel, onAdvance, onSubmitScorecard, onRequestReferences, onAddTransfer, onCreateOffer, onReject,
  isOfferStatus, isRejected, isHired,
  onMarkHired, canMarkHired, markHiredHelper, canOverride, onOverrideRelease,
}: ProfileQuickActionsCardProps) {
  const permissions = usePermissions()
  const isAdmin = permissions.isPlatformAdmin || permissions.isWorkspaceOwner || permissions.isAdmin
  const [overrideOpen, setOverrideOpen] = useState(false)

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
        <Button variant="secondary" size="md" icon={Users} onClick={onRequestReferences} className="w-full justify-center">
          Request references
        </Button>
        <Button variant="secondary" size="md" icon={ArrowLeftRight} onClick={onAddTransfer} className="w-full justify-center">
          Add/Transfer to job
        </Button>
        {isOfferStatus && (
          <Button variant="purple" size="md" icon={FileText} onClick={onCreateOffer} className="w-full justify-center">
            Create offer
          </Button>
        )}
        {isOfferStatus && onMarkHired && (
          <>
            <Button
              variant="success"
              size="md"
              icon={canMarkHired ? CheckCircle2 : Lock}
              onClick={canMarkHired ? onMarkHired : undefined}
              disabled={!canMarkHired}
              className="w-full justify-center"
              style={
                canMarkHired
                  ? undefined
                  : { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' }
              }
            >
              Mark hired
            </Button>
            {markHiredHelper && (
              <p className="flex items-start gap-1.5 pt-0.5 font-inter text-[11px]" style={{ color: canMarkHired ? '#8B8F9E' : '#8B6FE0' }}>
                {!canMarkHired && <Lock className="mt-[1px] h-3 w-3 shrink-0" />}
                {markHiredHelper}
              </p>
            )}
            {!canMarkHired && canOverride && isAdmin && (
              <button
                type="button"
                onClick={() => setOverrideOpen(true)}
                className="w-full text-center font-inter text-[11.5px] text-[#5B2FD1] hover:underline"
              >
                Override and release
              </button>
            )}
          </>
        )}
        {!isRejected && !isHired && (
          <Button variant="danger" size="md" icon={ThumbsDown} onClick={onReject} className="w-full justify-center">
            Reject candidate
          </Button>
        )}
      </div>

      <AlertDialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release without full sign-off?</AlertDialogTitle>
            <AlertDialogDescription>
              This releases the offer before the approval chain has cleared. The override is recorded in
              the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOverrideOpen(false)
                onOverrideRelease?.()
              }}
            >
              Override and release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

export default ProfileQuickActionsCard
