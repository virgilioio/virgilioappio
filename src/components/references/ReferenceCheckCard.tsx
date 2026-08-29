import { Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { RefGlyph } from '@/components/references/RefGlyph'
import { RefStatus } from '@/components/references/RefStatus'
import { composeRequirementLine } from '@/lib/references/requestCopy'

interface ReferenceCheckCardProps {
  /** Client (organization) name for this job, when there is one. */
  client?: string | null
  /** e.g. "2 references, one from a direct manager" — always from data. */
  requirement: string
  /** e.g. "usually back in about 4 days" — optional. */
  turnaround?: string | null
  /** The stage normally collects references → lilac prompt instead of the quiet row. */
  suggested?: boolean
  onRequest: () => void
}

/**
 * Reference check card on the Job overview tab, directly below Scorecards.
 * The suggested state is a PROMPT, never a gate: lilac, no warning icon,
 * nothing on the page becomes disabled.
 */
export function ReferenceCheckCard({
  client,
  requirement,
  turnaround,
  suggested = false,
  onRequest,
}: ReferenceCheckCardProps) {
  const requirementLine = suggested
    ? composeRequirementLine(requirement, client, turnaround)
    : null

  return (
    <ProfileCard
      title="Reference check"
      subtitle="Belongs to the candidate — reusable on any job they're put forward for"
      action={
        <Button variant="secondary" size="sm" icon={Plus} onClick={onRequest}>
          Request references
        </Button>
      }
    >
      {suggested ? (
        <div
          className="flex items-center"
          style={{
            gap: 12,
            padding: '12px 14px',
            background: '#FAF8FF',
            border: '1px solid #EDE4FF',
            borderRadius: 10,
          }}
        >
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{ width: 32, height: 32, borderRadius: 8, background: '#EDE4FF' }}
          >
            <RefGlyph size={17} color="#6F3FF5" accent="#6F3FF5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center" style={{ gap: 7 }}>
              <span
                className="font-poppins"
                style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2230' }}
              >
                Usually collected at this stage
              </span>
              <Badge tone="lilac" size="xs">
                Suggested
              </Badge>
            </div>
            <p
              className="font-inter"
              style={{ fontSize: 11, color: '#5A6072', marginTop: 2 }}
            >
              {requirementLine}
            </p>
          </div>
          <Button variant="purple" size="sm" icon={Send} onClick={onRequest}>
            Request
          </Button>
        </div>
      ) : (
        <div className="flex items-center" style={{ gap: 11, padding: '4px 0' }}>
          <RefStatus state="none" />
          <span className="font-inter" style={{ fontSize: 12, color: '#8B8F9E' }}>
            Nothing requested yet for this job.
          </span>
        </div>
      )}
    </ProfileCard>
  )
}

export default ReferenceCheckCard
