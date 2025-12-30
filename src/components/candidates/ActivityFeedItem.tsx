import { formatDistanceToNow } from 'date-fns';
import { Activity } from '@/hooks/useActivityFeed';
import { getActivityIcon, getActivityColor } from '@/utils/activityHelpers';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ActivityFeedItemProps {
  activity: Activity;
  isLast?: boolean;
}

export function ActivityFeedItem({ activity, isLast }: ActivityFeedItemProps) {
  const icon = getActivityIcon(activity.activity_type);
  const color = getActivityColor(activity.activity_type);
  
  // Get author name from profile data, metadata, or email
  const authorName = 
    (activity.author_first_name || activity.author_last_name)
      ? `${activity.author_first_name || ''} ${activity.author_last_name || ''}`.trim()
      : activity.metadata?.author_name 
        || activity.author_email?.split('@')[0] 
        || 'System';
  
  return (
    <div className="relative flex gap-3 pb-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
      )}
      
      {/* Icon */}
      <div 
        className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full shrink-0"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      
      {/* Content */}
      <div className="flex-1 pt-0.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium text-text-primary">{authorName}</span>
              <span className="text-text-secondary ml-1">
                {activity.title.toLowerCase()}
              </span>
            </p>
            {activity.description && (
              <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">
                {activity.description}
              </p>
            )}
          </div>
          <span className="text-xs text-text-tertiary whitespace-nowrap">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
        </div>
        
        {/* Expandable metadata for stage changes and other important info */}
        {activity.activity_type === 'candidate_stage_changed' && activity.metadata?.note && (
          <div className="mt-2 text-sm bg-surface-secondary p-2 rounded-brand border border-border">
            <p className="text-text-secondary italic">"{activity.metadata.note}"</p>
          </div>
        )}
        
        {activity.activity_type === 'candidate_profile_updated' && activity.metadata?.changes && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs text-accent hover:text-accent-hover mt-1">
              View changes →
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="text-xs bg-surface-secondary p-2 rounded-brand border border-border">
                <pre className="whitespace-pre-wrap font-mono">
                  {JSON.stringify(activity.metadata.changes, null, 2)}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
