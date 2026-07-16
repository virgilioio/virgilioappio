import { useEffect, useState } from 'react'
import { EmailHistoryList } from '@/components/candidates/EmailHistoryList'
import { EmailsSidebar } from '@/components/candidates/profile/tabs/SidebarRouter'
import { useEmailLogs } from '@/hooks/useEmailLogs'
import { supabase } from '@/integrations/supabase/client'
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
 * and the Independent Candidate Profile page. Reskin: the list component now
 * owns its own card chrome, header, filter/compose actions, and grouping.
 */
export function EmailsTabContent({
  candidateId,
  jobId,
  onCompose,
  onReply,
  onForward,
}: EmailsTabContentProps) {
  const [firstName, setFirstName] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!candidateId) return
      const { data } = await supabase
        .from('candidates')
        .select('first_name, name')
        .eq('id', candidateId)
        .maybeSingle()
      if (cancelled) return
      const fn = (data?.first_name as string | undefined) ||
        (data?.name as string | undefined)?.split(/\s+/)[0]
      setFirstName(fn || undefined)
    })()
    return () => {
      cancelled = true
    }
  }, [candidateId])

  return (
    <EmailHistoryList
      candidateId={candidateId}
      jobId={jobId}
      candidateFirstName={firstName}
      onCompose={onCompose}
      onReply={onReply}
      onForward={onForward}
    />
  )
}

export default EmailsTabContent

// ────────────────────────────────────────────────────────────────
// Sidebar container — derives Engagement/Activity/Connected-inbox
// props from the same email_logs feed the tab uses.
// ────────────────────────────────────────────────────────────────

export function EmailsSidebarContainer({ candidateId, jobId }: { candidateId: string; jobId?: string }) {
  const { data: emails } = useEmailLogs(candidateId, jobId)
  const [inbox, setInbox] = useState<{ email: string; status: 'syncing' | 'paused' | 'not_connected' } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_mail_identities')
        .select('email_address, sync_status')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (data?.email_address) {
        setInbox({
          email: data.email_address,
          status: data.sync_status === 'active' ? 'syncing' : data.sync_status === 'paused' ? 'paused' : 'not_connected',
        })
      }
    })()
    return () => { cancelled = true }
  }, [])

  const list = emails ?? []
  const sent = list.filter((e: any) => e.direction === 'sent').length
  const opened = list.filter((e: any) => !!e.opened_at).length
  const replied = list.filter((e: any) => !!e.replied_at).length
  const clicked = list.filter((e: any) => !!e.clicked_at).length
  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : null

  return (
    <EmailsSidebar
      sent={sent}
      opened={opened || null}
      replied={replied}
      linksClicked={clicked || null}
      openRate={openRate}
      inboxAddress={inbox?.email ?? null}
      inboxStatus={inbox?.status ?? 'not_connected'}
    />
  )
}
