import { ArrowLeft, ArrowRight, Calendar, ChevronLeft, ChevronRight, Heart, Mail, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, ensureAbsoluteUrl } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { ApplicationSwitcher } from '@/components/candidates/profile/ApplicationSwitcher'

// (avatar removed — initials helper no longer needed)

interface ProfileHeroCardProps {
  candidateName: string
  candidateFirstName?: string | null
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
  

  return (
    <section className="bg-white border border-virgilio-border rounded-2xl shadow-sm px-6 pt-5">
      {/* Top navigation strip: Back · Breadcrumb · Actions + Pager */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to job
            </button>
          )}
          <nav aria-label="breadcrumb" className="hidden md:flex items-center gap-1.5 text-body-sm text-text-tertiary min-w-0">
            <span className="text-text-tertiary/60">·</span>
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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {typeof fitScore === 'number' && fitScore > 0 && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-[34px] rounded-lg border border-virgilio-purple/20 bg-virgilio-purple/5">
              <span className="text-[10px] font-poppins font-semibold tracking-[0.08em] text-virgilio-purple/70 uppercase">AI Fit</span>
              <span className="font-poppins font-semibold text-virgilio-purple text-sm leading-none tabular-nums">
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
        </div>
      </div>

      {/* Identity row */}
      <div className="min-w-0">
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
          {linkedinUrl && (
            <button
              type="button"
              onClick={() => window.open(ensureAbsoluteUrl(linkedinUrl), '_blank')}
              className="p-1 rounded-md hover:bg-muted transition-colors text-text-tertiary hover:text-text-secondary"
              aria-label="Open LinkedIn profile"
            >
              <LinkedInFilled className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5 flex-wrap text-body-sm text-text-secondary">
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
          {onOpenFullProfile && (
            <>
              <span className="text-text-tertiary/60">·</span>
              <button
                type="button"
                onClick={onOpenFullProfile}
                className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
              >
                <UserRound className="h-3.5 w-3.5" /> Full profile
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs slot — sits flush with card bottom edge */}
      {tabs && <div className="mt-4">{tabs}</div>}
    </section>
  )
}

export default ProfileHeroCard
