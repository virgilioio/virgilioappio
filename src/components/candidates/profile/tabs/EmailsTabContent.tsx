import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileCard } from '@/components/candidates/profile/primitives/ProfileCard'
import { EmailHistoryList } from '@/components/candidates/EmailHistoryList'
import { useEmailLogs } from '@/hooks/useEmailLogs'
import { formatDistanceToNow } from 'date-fns'
import type { EmailHistoryCardEmail } from '@/components/candidates/EmailHistoryCard'

interface EmailsTabContentProps {
  candidateId: string
  jobId?: string
  onCompose: () => void
  onReply?: (email: EmailHistoryCardEmail) => void
  onForward?: (email: EmailHistoryCardEmail) => void
}

/**
 * Shared "Emails" tab body used by both the in-job Candidate Profile Sheet
 * and the Independent Candidate Profile page. Wraps the existing
 * `EmailHistoryList` inside the standard ProfileCard chrome and exposes a
 * primary Compose action that opens the app's existing email composer.
 */
export function EmailsTabContent({
  candidateId,
  jobId,
  onCompose,
  onReply,
  onForward,
}: EmailsTabContentProps) {
  const { data: emails } = useEmailLogs(candidateId, jobId)
  const count = emails?.length ?? 0

  const lastOpenedAt = (emails ?? [])
    .map((e: any) => e.opened_at)
    .filter(Boolean)
    .sort()
    .slice(-1)[0]

  const subtitle = count
    ? lastOpenedAt
      ? `${count} message${count === 1 ? '' : 's'} · last opened ${formatDistanceToNow(new Date(lastOpenedAt), { addSuffix: true })}`
      : `${count} message${count === 1 ? '' : 's'}`
    : 'No messages yet'

  return (
    <ProfileCard
      title="Emails"
      subtitle={subtitle}
      bodyPadding="tight"
      action={
        <Button variant="primary" size="sm" icon={Pencil} onClick={onCompose}>
          Compose
        </Button>
      }
    >
      <EmailHistoryList
        candidateId={candidateId}
        jobId={jobId}
        onReply={onReply}
        onForward={onForward}
      />
    </ProfileCard>
  )
}

export default EmailsTabContent
