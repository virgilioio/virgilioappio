import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ResumeRefreshStatus } from '@/hooks/useResumeRefresh'
import { cn } from '@/lib/utils'

/** One line of words for where a resume upload is (useResumeRefresh). */
function resumeStatusText(s: ResumeRefreshStatus, compact: boolean): string {
  const jobs = (n: number) => `${n} ${n === 1 ? 'job' : 'jobs'}`
  if (compact) {
    // Narrow places (sidebar file rows): the file name is already on the row.
    switch (s.phase) {
      case 'uploading': return 'Uploading…'
      case 'reading': return s.slow ? 'Still reading…' : 'Gio is reading it…'
      case 'scoring': return `Re-scoring Gio Fit · ${s.scored} of ${s.jobs}`
      case 'done': return s.jobs ? 'Profile and Gio Fit updated' : 'Profile updated'
      case 'unreadable': return 'Couldn’t read this file'
      case 'failed': return 'Upload failed · try again'
    }
  }
  switch (s.phase) {
    case 'uploading':
      return `Uploading ${s.fileName}…`
    case 'reading':
      return s.slow ? 'Still reading the resume. The profile updates on its own when it’s done.' : 'Gio is reading the new resume…'
    case 'scoring':
      return `Profile updated · Re-scoring Gio Fit (${s.scored} of ${jobs(s.jobs)})…`
    case 'done':
      if (!s.jobs) return 'Profile updated from the new resume just now'
      return s.scored >= s.jobs
        ? `Profile updated · Gio Fit re-scored on ${jobs(s.jobs)}`
        : `Profile updated · Gio Fit re-scored on ${s.scored} of ${jobs(s.jobs)}`
    case 'unreadable':
      return 'Couldn’t read this resume. Upload a PDF or DOCX with selectable text.'
    case 'failed':
      return `Couldn’t upload ${s.fileName}. Try again.`
  }
}

/**
 * The status as a single line: spinner while working, a check when done, an
 * alert when it went wrong. Each step crossfades (gio-autosave-label); the
 * line keeps its height so nothing around it moves.
 */
export function ResumeStatusLine({ status, compact = false, className }: { status: ResumeRefreshStatus; compact?: boolean; className?: string }) {
  const working = status.phase === 'uploading' || status.phase === 'reading' || status.phase === 'scoring'
  const bad = status.phase === 'unreadable' || status.phase === 'failed'
  const text = resumeStatusText(status, compact)
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('flex min-h-[16px] min-w-0 items-center gap-1.5 font-inter text-[11px]', bad ? 'text-[#C2372B]' : 'text-[#5A6072]', className)}
    >
      <span key={`${status.phase}-${working ? 'w' : 'i'}`} className="gio-autosave-label inline-flex shrink-0 items-center">
        {working ? (
          <span className="gio-spinner gio-spinner-current" style={{ width: 11, height: 11, borderWidth: 1.5 }} aria-hidden="true" />
        ) : bad ? (
          <AlertCircle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-[#12B886]" strokeWidth={2} aria-hidden="true" />
        )}
      </span>
      <span key={text} className="gio-autosave-label truncate">
        {text}
      </span>
    </span>
  )
}
