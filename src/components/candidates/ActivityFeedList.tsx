import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { useActivityFeed, type Activity } from '@/hooks/useActivityFeed';
import { ActivityFeedItem } from './ActivityFeedItem';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedEmpty, type EmptyStateAction } from '@/components/empty/AnimatedEmpty';
import { LoadError } from '@/components/empty/LoadError';
import { activityMeta, type ActivityCategory } from '@/lib/activityRegistry';

interface ActivityFeedListProps {
  candidateId: string;
  jobId?: string;
  /** Category ids to show. Undefined = show everything. */
  visibleCategories?: ActivityCategory[];
  /** Jump to the Emails tab and scroll a message into view. */
  onOpenInEmails?: (emailLogId: string) => void;
  /** Shows every category again (filtered empty). */
  onClearFilters?: () => void;
  /** The action on the truly empty state, e.g. Schedule interview. */
  emptyAction?: EmptyStateAction;
}

export function ActivityFeedList({ candidateId, jobId, visibleCategories, onOpenInEmails, onClearFilters, emptyAction }: ActivityFeedListProps) {
  const { data: activities, isLoading, error, refetch } = useActivityFeed(candidateId, jobId);

  const visible = useMemo(() => {
    const list = (activities || []) as Activity[];
    const sorted = [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (!visibleCategories) return sorted;
    const allowed = new Set(visibleCategories);
    return sorted.filter(a => allowed.has(activityMeta(a.activity_type).category));
  }, [activities, visibleCategories]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // §16: an error is never an empty feed. With events already shown, they stay.
  if (error && !activities?.length) {
    return (
      <div className="py-8">
        <LoadError what="activity" compact onRetry={() => { void refetch(); }} />
      </div>
    );
  }

  if (visible.length === 0) {
    const total = activities?.length ?? 0;
    return (
      <div className="py-4">
        {total > 0 ? (
          // §17: categories hide every event → search scene with Clear filters.
          <AnimatedEmpty
            scene="search"
            size="compact"
            onceKey="candidate-activity"
            title="No activity matches these filters"
            body={`${total.toLocaleString()} ${total === 1 ? 'event is' : 'events are'} hidden by your filters.`}
            primary={onClearFilters ? { label: 'Clear filters', icon: <RotateCcw size={16} strokeWidth={2} />, onClick: onClearFilters } : undefined}
          />
        ) : (
          <AnimatedEmpty
            scene="scheduling"
            size="compact"
            onceKey="candidate-activity"
            title="No activities yet"
            body="Calls, meetings and interviews with this candidate show up here."
            primary={emptyAction}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {visible.map((activity, index) => (
        <ActivityFeedItem
          key={activity.id}
          activity={activity}
          isLast={index === visible.length - 1}
          onOpenInEmails={onOpenInEmails}
        />
      ))}
    </div>
  );
}
