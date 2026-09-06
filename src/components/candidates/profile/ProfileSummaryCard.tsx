import { RefreshCw, Sparkles } from 'lucide-react'
import { ProfileCard } from './primitives/ProfileCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GioSweepBar } from '@/components/shared/GioSweepBar'
import { SafeHtml } from '@/components/ui/safe-html'
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown'
import { useRegenerateSummary } from '@/hooks/useRegenerateSummary'

interface ProfileSummaryCardProps {
  candidateId: string
  candidateName?: string | null
  summary?: string | null
  /** True when a resume parse is already generating a summary in the background. */
  externallyRunning?: boolean
  /** Refresh the profile once the job completes. */
  onRegenerated?: () => void
  canRegenerate?: boolean
}

const looksLikeHtml = (value: string) => /<\w+[^>]*>/.test(value)

/** Profile summary card — identical on the independent and in-job profiles. */
export function ProfileSummaryCard({
  candidateId,
  candidateName,
  summary,
  externallyRunning,
  onRegenerated,
  canRegenerate = true,
}: ProfileSummaryCardProps) {
  const { isRegenerating, error, regenerate } = useRegenerateSummary(candidateId, candidateName)
  const running = isRegenerating || !!externallyRunning

  return (
    <ProfileCard
      title="Profile summary"
      subtitle={running ? 'Gio is re-reading the resume…' : undefined}
      badge={
        <Badge tone="lilac" size="xs" icon={Sparkles}>
          {running ? 'Regenerating…' : 'Gio summary'}
        </Badge>
      }
      action={
        canRegenerate ? (
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            disabled={running}
            onClick={() => void regenerate(onRegenerated)}
          >
            {running ? 'Working…' : 'Regenerate'}
          </Button>
        ) : undefined
      }
    >
      {running && <GioSweepBar />}

      <div
        style={{ opacity: running ? 0.4 : 1, transition: 'opacity 180ms ease' }}
      >
        {summary ? (
          looksLikeHtml(summary) ? (
            <SafeHtml
              content={summary}
              className="font-inter text-[13.5px] leading-relaxed text-[#1F2230] [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            />
          ) : (
            <ProfileSummaryMarkdown content={summary} />
          )
        ) : (
          <p className="font-inter text-[13px] text-[#8B8F9E] italic">
            No summary yet. Regenerate to let Gio write one from the candidate's profile.
          </p>
        )}
      </div>

      {error && (
        <p className="mt-2.5 font-inter text-[11.5px] text-destructive">{error}</p>
      )}
    </ProfileCard>
  )
}

export default ProfileSummaryCard
