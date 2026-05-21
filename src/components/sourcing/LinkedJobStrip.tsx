import { useNavigate } from 'react-router-dom'
import { Link2, ArrowUpRight, Link2Off } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LinkedJobStripProps {
  jobId: string
  jobTitle?: string | null
  department?: string | null
  onUnlink: () => void | Promise<void>
}

/**
 * Slim emerald strip shown when a sourcing project is linked to a job.
 * Replaces the yellow LinkToJobBanner.
 */
export function LinkedJobStrip({ jobId, jobTitle, department, onUnlink }: LinkedJobStripProps) {
  const navigate = useNavigate()
  const title = jobTitle || 'this job'

  return (
    <div className="flex items-center gap-3 rounded-lg bg-emerald-50 ring-1 ring-emerald-200/60 pl-3 pr-1.5 py-1.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
        <Link2 className="h-3.5 w-3.5" />
      </div>
      <p className="flex-1 min-w-0 truncate text-[12.5px] text-text-primary">
        Linked to job{' '}
        <span className="font-semibold">{title}</span>
        {department && (
          <span className="text-text-tertiary"> · {department}</span>
        )}
        <span className="text-text-secondary">
          {' '}· collected candidates drop into the <span className="font-medium text-text-primary">Sourced</span> stage automatically.
        </span>
      </p>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          icon={ArrowUpRight}
          onClick={() => navigate(`/jobs/${jobId}`)}
        >
          Open job
        </Button>
        <Button size="sm" variant="ghost" icon={Link2Off} onClick={() => onUnlink()}>
          Unlink
        </Button>
      </div>
    </div>
  )
}
