import { ArrowLeft, ChevronLeft, ChevronRight, Heart, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Button } from '@/components/ui/button'
import { cn, ensureAbsoluteUrl } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { ApplicationSwitcher } from '@/components/candidates/profile/ApplicationSwitcher'


import { ClientVerdictPill } from '@/components/candidates/profile/ClientVerdictPill'
import type { ClientVerdictState } from '@/hooks/useClientVerdict'

interface ProfileHeroCardProps {
  candidateName: string
  candidateFirstName?: string | null
  candidateId: string
  jobId: string
  jobTitle?: string | null
  source?: string | null
  appliedAt?: string | null
  currentStageName?: string | null
  /** Days in current stage. Renders next to stage chip. */
  daysInStage?: number | null
  isFavorite?: boolean
  onToggleFavorite?: () => void
  onOpenFullProfile?: () => void
  linkedinUrl?: string | null
  fitScore?: number | null
  /** The client's answer on a shared dossier. Sits beside the Gio Fit pill as its pair. */
  clientVerdictState?: ClientVerdictState
  onFitClick?: () => void
  onClose?: () => void
  index?: number | null
  total?: number | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  tabs?: ReactNode
  /** Overflow menu — last element of the hero action row, after prev/next. */
  actionMenu?: ReactNode
}

export function ProfileHeroCard({
  candidateName, candidateFirstName, candidateId, jobId, jobTitle,
  currentStageName, daysInStage, isFavorite, onToggleFavorite, onOpenFullProfile, linkedinUrl,
  fitScore, onFitClick, clientVerdictState = 'none',
  onClose, hasPrev, hasNext, onNavigatePrev, onNavigateNext,
  tabs, actionMenu,
}: ProfileHeroCardProps) {


  return (
    <section className="bg-white border border-[#E7E8EE] rounded-[16px] shadow-[0_1px_2px_rgba(13,13,9,0.04)] pt-3.5 px-6 pb-0">
      {/* Row 1 — breadcrumb · spacer · actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 font-poppins font-medium text-[12.5px] text-[#5A6072] hover:text-[#1F2230] transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to job
            </button>
          )}
          <span className="text-[#D1D5DB]">·</span>
          <nav aria-label="breadcrumb" className="hidden md:flex items-center gap-1.5 font-inter text-[11.5px] text-[#8B8F9E] min-w-0">
            <Link to="/jobs" className="hover:text-[#5A6072] transition-colors">Jobs</Link>
            {jobTitle && (
              <>
                <span className="text-[#D1D5DB]">›</span>
                <Link to={`/jobs/${jobId}`} className="hover:text-[#5A6072] transition-colors truncate max-w-[260px]">
                  {jobTitle}
                </Link>
              </>
            )}
            <span className="text-[#D1D5DB]">›</span>
            <span className="text-[#1F2230] font-medium">Candidates</span>
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ClientVerdictPill state={clientVerdictState} />
          {typeof fitScore === 'number' && fitScore > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onFitClick}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-[34px] rounded-full bg-[#F4EFFE] border border-[#E6DAFB] hover:bg-[#EDE4FF]"
              aria-label={`Open Gio Fit analysis, score ${Math.round(fitScore)}`}
            >
              <span className="font-inter font-bold text-[10px] tracking-[0.08em] text-virgilio-purple uppercase">GIO FIT</span>
              <span className="font-poppins font-semibold text-virgilio-purple text-[14px] leading-none tabular-nums">
                {Math.round(fitScore)}
              </span>
            </Button>
          )}
          {onOpenFullProfile && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              iconOnly
              aria-label="Open full profile"
              title="Open full profile"
              icon={UserRound}
              onClick={onOpenFullProfile}
            />
          )}
          {onOpenFullProfile && (onNavigatePrev || onNavigateNext) && (
            <span aria-hidden="true" className="mx-[2px] h-[18px] w-px bg-[#E7E8EE] shrink-0" />
          )}
          {(onNavigatePrev || onNavigateNext) && (
            <>
              <Button
                variant="secondary"
                size="md"
                iconOnly
                aria-label="Previous candidate"
                icon={ChevronLeft}
                onClick={onNavigatePrev}
                disabled={!hasPrev}
              />
              <Button
                variant="secondary"
                size="md"
                iconOnly
                aria-label="Next candidate"
                icon={ChevronRight}
                onClick={onNavigateNext}
                disabled={!hasNext}
              />
            </>
          )}
          {actionMenu}
        </div>
      </div>

      {/* Row 2 — identity */}
      <div className="mt-3.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-poppins font-semibold tracking-[-0.04em] text-[#1F2230] text-[28px] sm:text-[32px] leading-none -translate-y-0.5 truncate">
            {candidateName}
            <span className="text-[#D7C5FB]">.</span>
          </h1>
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F1F0EC] transition-colors"
              aria-label={isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
            >
              <Heart className={cn('h-5 w-5', isFavorite ? 'fill-red-500 text-red-500' : 'text-[#8B8F9E] hover:text-red-400')} />
            </button>
          )}
          {currentStageName && (
            <span className="inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-full bg-[#EDE4FF] text-virgilio-purple font-inter font-semibold text-[11.5px]">
              <span className="h-1.5 w-1.5 rounded-full bg-virgilio-purple" />
              {currentStageName}
              {typeof daysInStage === 'number' && daysInStage >= 0 && (
                <span className="text-virgilio-purple/70 font-medium">· {daysInStage}d in stage</span>
              )}
            </span>
          )}
          {linkedinUrl && (
            <button
              type="button"
              onClick={() => window.open(ensureAbsoluteUrl(linkedinUrl), '_blank')}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F1F0EC] transition-colors text-[#8B8F9E] hover:text-[#5A6072]"
              aria-label="Open LinkedIn profile"
            >
              <LinkedInFilled className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Row 3 — meta */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap font-inter text-[12.5px] text-[#5A6072]">
          {candidateId && (
            <ApplicationSwitcher
              candidateId={candidateId}
              candidateFirstName={candidateFirstName || candidateName?.split(' ')[0] || null}
              currentJobId={jobId}
              currentJobTitle={jobTitle || null}
            />
          )}
        </div>
      </div>

      {/* Row 4 — tabs sit flush on the card bottom edge */}
      {tabs && <div className="mt-2.5">{tabs}</div>}
    </section>
  )
}

export default ProfileHeroCard
