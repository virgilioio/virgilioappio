import { formatDistanceToNow } from 'date-fns'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ActivityFeedList } from '@/components/candidates/ActivityFeedList'
import { ActivitySidebar } from '@/components/candidates/profile/tabs/SidebarRouter'
import { useEmailStats, type CandidateActivity } from '@/hooks/useCandidateActivity'
import type { EmptyStateAction } from '@/components/empty/AnimatedEmpty'

/**
 * The Activity tab, shared by the in-job profile and the standalone profile
 * (2026-10-19). Emails live here now: each one in the feed has Reply and
 * Forward, and the email numbers sit in the sidebar under Filter and Stats.
 */
export function ActivityTabCard({
  activity,
  candidateId,
  jobId,
  onEmailAction,
  emptyAction,
}: {
  activity: CandidateActivity
  candidateId: string
  jobId?: string | null
  onEmailAction: (emailLogId: string, mode: 'reply' | 'forward') => void | Promise<void>
  emptyAction?: EmptyStateAction
}) {
  const count = activity.events.length
  return (
    <Card className="bg-surface-primary border-border">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Activity</CardTitle>
          <p className="mt-1 font-inter text-[11.5px] text-[#8B8F9E]">
            {/* Never "0 events" while the feed is still loading. */}
            {activity.isLoading ? 'Loading…' : `${count} event${count === 1 ? '' : 's'}`}
            {!activity.isLoading && activity.lastUpdate
              ? ` · last update ${formatDistanceToNow(new Date(activity.lastUpdate), { addSuffix: true })}`
              : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={RotateCw} onClick={() => activity.refetch()} loading={activity.isFetching}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[460px]">
          <div className="p-6">
            <ActivityFeedList
              candidateId={candidateId}
              jobId={jobId || undefined}
              visibleCategories={activity.visibleCategories}
              onClearFilters={() => activity.setFilters({})}
              emptyAction={emptyAction}
              onEmailAction={onEmailAction}
            />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function ActivityTabSidebar({
  activity,
  candidateId,
  jobId,
  activeDays,
}: {
  activity: CandidateActivity
  candidateId: string
  jobId?: string | null
  /** Days in the current stage (in a job); leave it out on the standalone profile. */
  activeDays?: number | null
}) {
  const email = useEmailStats(candidateId, jobId)
  return (
    <ActivitySidebar
      totalEvents={activity.events.length}
      categoryRows={activity.categoryRows}
      filters={activity.filters}
      onFilterChange={activity.setFilters}
      stats={{
        ...(jobId ? { activeDays: activeDays ?? null } : {}),
        eventsLogged: activity.isLoading ? null : activity.events.length,
        automatedEvents: activity.isLoading ? null : activity.automatedCount,
        lastContact: activity.lastContact,
      }}
      email={email}
    />
  )
}
