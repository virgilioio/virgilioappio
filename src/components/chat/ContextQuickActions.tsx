import { useNavigate } from 'react-router-dom'
import { CalendarPlus, ArrowRightCircle, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ContextQuickActionsProps {
  jobId: string | null
  candidateId: string | null
}

/**
 * ContextQuickActions — Schedule / Move stage / Add note (Step 1.8).
 *
 * These deep-link into the existing in-job candidate profile, which already
 * owns the scheduling, stage-move, and notes flows. We do NOT build any new
 * scheduling or notes infrastructure here — per Step 1.8 scope.
 */
export function ContextQuickActions({ jobId, candidateId }: ContextQuickActionsProps) {
  const navigate = useNavigate()

  const disabled = !jobId || !candidateId
  const profileBase = jobId && candidateId ? `/jobs/${jobId}/candidates/${candidateId}` : ''

  const go = (hash: string) => () => {
    if (disabled) return
    navigate(`${profileBase}${hash}`)
  }

  return (
    <div className="px-4 py-3">
      <h4 className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-text-secondary mb-2.5">
        Quick actions
      </h4>
      <div className="grid grid-cols-1 gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          icon={CalendarPlus}
          disabled={disabled}
          onClick={go('#schedule')}
          className="justify-start w-full"
        >
          Schedule interview
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={ArrowRightCircle}
          disabled={disabled}
          onClick={go('#move-stage')}
          className="justify-start w-full"
        >
          Move stage
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={StickyNote}
          disabled={disabled}
          onClick={go('#notes')}
          className="justify-start w-full"
        >
          Add note
        </Button>
      </div>
    </div>
  )
}
