import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useActivityFeed } from '@/hooks/useActivityFeed'
import { useEmailLogs } from '@/hooks/useEmailLogs'
import { activityMeta, ACTIVITY_CATEGORIES, isAutomated, type ActivityCategory } from '@/lib/activityRegistry'

/**
 * A candidate's Activity tab, shared by the in-job profile and the standalone
 * profile (2026-10-19): one feed for the list, the card subtitle, the sidebar
 * filters and the tab badge, plus the category filters. `jobId` narrows the
 * feed to one job; without it the feed covers every job and the person.
 */
export function useCandidateActivity(candidateId: string | null | undefined, jobId?: string | null) {
  const [filters, setFilters] = useState<Record<string, boolean>>({})
  const feed = useActivityFeed(candidateId || undefined, jobId || undefined)

  const derived = useMemo(() => {
    const events = feed.data || []
    const byCategory = new Map<string, number>()
    events.forEach((e) => {
      const cat = activityMeta(e.activity_type).category
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1)
    })
    const categoryRows = ACTIVITY_CATEGORIES
      .map((c) => ({ id: c.id as string, label: c.label, count: byCategory.get(c.id) || 0 }))
      .filter((c) => c.count > 0)
    const automatedCount = events.filter((e) => isAutomated(e)).length
    const lastContact = events
      .filter((e) =>
        e.activity_type === 'candidate_email_sent' ||
        e.activity_type === 'candidate_email_received' ||
        e.activity_type === 'candidate_email_automated'
      )
      .map((e) => e.created_at)
      .sort()
      .pop() || null
    const lastUpdate = events.map((e) => e.created_at).sort().pop() || null
    return { events, categoryRows, automatedCount, lastContact, lastUpdate }
  }, [feed.data])

  const visibleCategories = useMemo(
    () => derived.categoryRows.filter((c) => filters[c.id] ?? true).map((c) => c.id as ActivityCategory),
    [derived.categoryRows, filters],
  )

  // A new candidate starts with every category shown.
  useEffect(() => setFilters({}), [candidateId, jobId])

  return {
    ...derived,
    filters,
    setFilters,
    visibleCategories,
    isLoading: feed.isLoading,
    isFetching: feed.isFetching,
    refetch: feed.refetch,
  }
}

export type CandidateActivity = ReturnType<typeof useCandidateActivity>

export type InboxStatus = 'syncing' | 'paused' | 'not_connected'

export interface EmailStats {
  sent: number
  opened: number
  replied: number
  clicked: number
  /** Opened ÷ sent, null before anything is sent. */
  openRate: number | null
  inbox: { email: string; status: InboxStatus } | null
}

/** The email numbers for the Activity sidebar (they used to be the Emails tab's sidebar). */
export function useEmailStats(candidateId: string | null | undefined, jobId?: string | null): EmailStats | null {
  const { data: emails, isLoading } = useEmailLogs(candidateId || undefined, jobId || undefined)
  const { data: inbox = null } = useQuery({
    queryKey: ['my-mail-identity'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('user_mail_identities')
        .select('email_address, sync_status')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (!data?.email_address) return null
      return {
        email: data.email_address as string,
        status: (data.sync_status === 'active' ? 'syncing' : data.sync_status === 'paused' ? 'paused' : 'not_connected') as InboxStatus,
      }
    },
  })
  // Never a 0 while the numbers are still loading.
  if (isLoading) return null
  const list = (emails ?? []) as { direction?: string | null; opened_at?: string | null; replied_at?: string | null; clicked_at?: string | null }[]
  const sent = list.filter((e) => e.direction === 'sent').length
  const opened = list.filter((e) => !!e.opened_at).length
  return {
    sent,
    opened,
    replied: list.filter((e) => !!e.replied_at).length,
    clicked: list.filter((e) => !!e.clicked_at).length,
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : null,
    inbox,
  }
}
