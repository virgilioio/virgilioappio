import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A candidate page opened from a link that doesn't hold a candidate (an email
 * that said /candidates/undefined, Allan 2026-10-27) shows one plain "not
 * found" state instead of loading the profile and failing every request on it.
 */
export function CandidateLinkGuard({ children }: { children: ReactNode }) {
  const { candidateId, jobId } = useParams()
  const navigate = useNavigate()
  if (candidateId && UUID.test(candidateId)) return <>{children}</>
  const back = jobId && UUID.test(jobId) ? `/jobs/${jobId}` : '/candidates'
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <AnimatedEmpty
        scene="search"
        title="This link doesn't lead to a candidate"
        body="It may have been cut off or sent before the candidate was ready. Find them from the job or the Candidates list instead."
        primary={{
          label: jobId && UUID.test(jobId) ? 'Back to the job' : 'Go to Candidates',
          icon: <ArrowLeft size={16} strokeWidth={2} />,
          onClick: () => navigate(back),
        }}
      />
    </div>
  )
}
