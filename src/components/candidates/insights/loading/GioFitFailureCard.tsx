import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import './gioFitLoading.css'

const cardClass = 'rounded-[14px] border border-virgilio-border bg-surface-primary'

function FailureShell({ title, body, actions }: { title: string; body: string; actions: React.ReactNode }) {
  return (
    <section className={cardClass} role="alert">
      <div className="flex gap-3.5 p-7">
        <span className="gf-fail-chip" aria-hidden><AlertTriangle className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h3 className="gf-fail-title font-poppins">{title}</h3>
          <p className="gf-fail-body">{body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
    </section>
  )
}

export function GioFitErrorCard({ onRetry, isRetrying }: { onRetry: () => void; isRetrying?: boolean }) {
  return (
    <FailureShell
      title="Gio could not finish scoring this candidate"
      body="The assessment timed out while comparing dimensions. Nothing was saved, and the previous dossier is untouched."
      actions={<Button variant="purple" size="md" icon={RefreshCw} loading={isRetrying} onClick={onRetry}>Try again</Button>}
    />
  )
}

export function GioFitBlockedCard({ jobId, onRetry, isRetrying }: { jobId: string; onRetry: () => void; isRetrying?: boolean }) {
  return (
    <FailureShell
      title="This job needs a description before Gio can score"
      body="The job description is under 30 characters, so there is nothing to assess against. Add one and the score will generate automatically."
      actions={
        <>
          <Button variant="purple" size="md" icon={RefreshCw} loading={isRetrying} onClick={onRetry}>Try again</Button>
          <Button variant="secondary" size="md" icon={ExternalLink} asChild>
            <Link to={`/jobs/${jobId}/setup`}>Open the job</Link>
          </Button>
        </>
      }
    />
  )
}
