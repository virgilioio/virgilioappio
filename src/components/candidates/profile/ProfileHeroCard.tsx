import { ArrowLeft, ArrowRight, Calendar, ChevronLeft, ChevronRight, Heart, Mail, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, ensureAbsoluteUrl } from '@/lib/utils'
import { Link } from 'react-router-dom'

function getInitials(name?: string | null) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
}

interface ProfileHeroCardProps {
  candidateName: string
  candidateId: string
  jobId: string
  jobTitle?: string | null
  source?: string | null
  appliedAt?: string | null
  currentStageName?: string | null
  isFavorite?: boolean
  onToggleFavorite?: () => void
  onOpenFullProfile?: () => void
  linkedinUrl?: string | null
  fitScore?: number | null
  // Top navigation strip (Back / Breadcrumb / Pager)
  onClose?: () => void
  index?: number | null
  total?: number | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  tabs?: ReactNode
  // Primary actions (mirrors JobHero right-side cluster)
  nextStageLabel?: string | null
  onAdvance?: () => void
  onSchedule?: () => void
  onEmail?: () => void
  isRejected?: boolean
  isHired?: boolean
}

function relativeTime(iso?: string | null) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  const days = Math.floor(ms / 86_400_000)
  if (days < 1) return 'today'
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

export function ProfileHeroCard({
  candidateName, candidateId, jobId, jobTitle, source, appliedAt,
  currentStageName, isFavorite, onToggleFavorite, onOpenFullProfile, linkedinUrl,
  fitScore,
  onClose, index, total, hasPrev, hasNext, onNavigatePrev, onNavigateNext,
  tabs,
  nextStageLabel, onAdvance, onSchedule, onEmail, isRejected, isHired,
}: ProfileHeroCardProps) {
  const applied = relativeTime(appliedAt)
  const showPager = typeof index === 'number' && typeof total === 'number' && total > 0

  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm px-6 pt-5">
      {/* Top navigation strip: Back · Breadcrumb · Pager */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to job
            </button>
          )}
        </div>

        <nav aria-label="breadcrumb" className="hidden md:flex items-center gap-1.5 text-body-sm text-text-tertiary min-w-0">
          <Link to="/jobs" className="hover:text-text-secondary transition-colors">Jobs</Link>
          {jobTitle && (
            <>
              <span className="text-text-tertiary/60">›</span>
              <Link to={`/jobs/${jobId}`} className="hover:text-text-secondary transition-colors truncate max-w-[260px]">
                {jobTitle}
              </Link>
            </>
          )}
          <span className="text-text-tertiary/60">›</span>
          <span className="text-text-secondary">Candidates</span>
        </nav>

        <div className="flex-1 flex items-center justify-end gap-2">
          {showPager && (
            <span className="text-body-sm font-poppins text-text-secondary tabular-nums">
              {index} of {total}
            </span>
          )}
          {(onNavigatePrev || onNavigateNext) && (
            <>
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                aria-label="Previous candidate"
                icon={ChevronLeft}
                onClick={onNavigatePrev}
                disabled={!hasPrev}
              />
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                aria-label="Next candidate"
                icon={ChevronRight}
                onClick={onNavigateNext}
                disabled={!hasNext}
              />
            </>
          )}
        </div>
      </div>

      {/* Identity row */}
      <div className="flex items-start gap-4 sm:gap-5">
        {/* Avatar */}
        <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-full bg-virgilio-purple text-white flex items-center justify-center font-poppins font-semibold text-2xl sm:text-3xl tracking-[-0.04em]">
          {getInitials(candidateName)}
        </div>

        {/* Identity block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[28px] sm:text-[32px] leading-tight truncate">
              {candidateName}
              <span className="text-virgilio-purple">.</span>
            </h1>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={onToggleFavorite}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label={isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
              >
                <Heart className={cn('h-5 w-5', isFavorite ? 'fill-red-500 text-red-500' : 'text-text-tertiary hover:text-red-400')} />
              </button>
            )}
            {currentStageName && (
              <Badge tone="purple" size="sm" dot>{currentStageName}</Badge>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-body-sm text-text-secondary">
            {jobTitle && (
              <>
                <span>Applying for</span>
                <Link to={`/jobs/${jobId}`} className="text-text-primary font-medium hover:underline truncate max-w-[260px]">
                  {jobTitle}
                </Link>
              </>
            )}
            {source && (
              <>
                <span className="text-text-tertiary/60">·</span>
                <span>Source: <span className="text-text-primary font-medium">{source}</span></span>
              </>
            )}
            {applied && (
              <>
                <span className="text-text-tertiary/60">·</span>
                <span>Applied {applied}</span>
              </>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            {onOpenFullProfile && (
              <Button variant="ghost" size="xs" icon={UserRound} onClick={onOpenFullProfile}>
                Full profile
              </Button>
            )}
            {linkedinUrl && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => window.open(ensureAbsoluteUrl(linkedinUrl), '_blank')}
                aria-label="Open LinkedIn profile"
              >
                <LinkedInFilled className="h-3.5 w-3.5 mr-1" />
                LinkedIn
              </Button>
            )}
          </div>
        </div>

        {/* Right cluster: AI Fit + primary actions */}
        <div className="hidden sm:flex items-start gap-2 shrink-0">
          {typeof fitScore === 'number' && fitScore > 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-2.5 rounded-xl border border-virgilio-purple/20 bg-virgilio-purple/5 min-w-[80px]">
              <span className="text-[10px] font-poppins font-semibold tracking-[0.08em] text-virgilio-purple/70 uppercase">AI Fit</span>
              <span className="font-poppins font-semibold text-virgilio-purple text-2xl leading-none mt-1 tabular-nums">
                {Math.round(fitScore)}
              </span>
            </div>
          )}
          {nextStageLabel && !isRejected && !isHired && onAdvance && (
            <Button variant="primary" size="md" iconRight={ArrowRight} onClick={onAdvance}>
              Advance to {nextStageLabel}
            </Button>
          )}
          {onSchedule && (
            <Button variant="secondary" size="md" icon={Calendar} onClick={onSchedule}>
              Schedule
            </Button>
          )}
          {onEmail && (
            <Button variant="secondary" size="md" icon={Mail} onClick={onEmail}>
              Email
            </Button>
          )}
        </div>
      </div>

      {/* Tabs slot — sits flush with card bottom edge */}
      {tabs && <div className="mt-4">{tabs}</div>}
    </section>
  )
}

export default ProfileHeroCard
