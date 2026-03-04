import { Activity as ActivityIcon } from 'lucide-react';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { ActivityFeedItem } from './ActivityFeedItem';
import { Skeleton } from '@/components/ui/skeleton';
import gioFaceEmpty from '@/assets/gio-face-empty.png';

interface ActivityFeedListProps {
  candidateId: string;
  jobId?: string;
}

export function ActivityFeedList({ candidateId, jobId }: ActivityFeedListProps) {
  const { data: activities, isLoading, error } = useActivityFeed(candidateId, jobId);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
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
  
  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-surface-secondary p-3 mb-4">
          <ActivityIcon className="h-6 w-6 text-text-secondary" />
        </div>
        <h3 className="text-sm font-medium text-text-primary mb-1">
          No activity yet
        </h3>
        <p className="text-xs text-text-secondary max-w-sm">
          Activity for this candidate will appear here as you interact with them.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-0">
      {activities.map((activity, index) => (
        <ActivityFeedItem 
          key={activity.id} 
          activity={activity}
          isLast={index === activities.length - 1}
        />
      ))}
    </div>
  );
}
