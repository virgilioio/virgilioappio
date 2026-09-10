import { useMemo } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import { useActivityFeed, type Activity } from '@/hooks/useActivityFeed';
import { ActivityFeedItem } from './ActivityFeedItem';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineEmpty } from '@/components/ui/empty-state';
import { activityMeta, type ActivityCategory } from '@/lib/activityRegistry';

interface ActivityFeedListProps {
  candidateId: string;
  jobId?: string;
  /** Category ids to show. Undefined = show everything. */
  visibleCategories?: ActivityCategory[];
  /** Jump to the Emails tab and scroll a message into view. */
  onOpenInEmails?: (emailLogId: string) => void;
}

export function ActivityFeedList({ candidateId, jobId, visibleCategories, onOpenInEmails }: ActivityFeedListProps) {
  const { data: activities, isLoading, error } = useActivityFeed(candidateId, jobId);

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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-surface-secondary p-3 mb-4">
          <ActivityIcon className="h-6 w-6 text-text-secondary" />
        </div>
        <p className="text-sm text-destructive">
          Failed to load activity feed
        </p>
      </div>
    );
  }

  if (visible.length === 0) {
    return <InlineEmpty text="No activity yet." />;
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
