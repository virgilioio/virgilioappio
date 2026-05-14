import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

interface ProfileTopBarProps {
  jobId: string
  jobTitle?: string | null
  onClose: () => void
  index?: number | null
  total?: number | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
}

export function ProfileTopBar({
  jobId, jobTitle, onClose, index, total, hasPrev, hasNext, onNavigatePrev, onNavigateNext,
}: ProfileTopBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-2 sm:px-4 py-3">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary font-poppins text-[13px] tracking-[-0.005em] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job
      </button>

      <nav className="hidden md:flex items-center gap-2 text-[13px] font-poppins text-text-tertiary min-w-0">
        <Link to="/jobs" className="hover:text-text-primary transition-colors">Jobs</Link>
        <span className="text-text-tertiary/60">›</span>
        <Link to={`/jobs/${jobId}`} className="hover:text-text-primary transition-colors truncate max-w-[260px]">
          {jobTitle || 'Job'}
        </Link>
        <span className="text-text-tertiary/60">›</span>
        <span className="text-text-primary font-medium">Candidates</span>
      </nav>

      <div className="flex items-center gap-2">
        {typeof index === 'number' && typeof total === 'number' && total > 0 && (
          <span className="text-[13px] font-poppins text-text-secondary tabular-nums">
            {index} of {total}
          </span>
        )}
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
      </div>
    </div>
  )
}

export default ProfileTopBar
