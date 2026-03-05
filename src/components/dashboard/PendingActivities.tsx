import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { usePendingActivities, PendingActivity } from '@/hooks/usePendingActivities';
import { ClipboardList, Clock, ChevronRight, MoreHorizontal, CheckCheck, ExternalLink, ClipboardCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import gioFaceGreen from '@/assets/gio-face-green.png';
import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export function PendingActivities() {
  const navigate = useNavigate();
  const { data: activities, isLoading, error, markEmailAsRead } = usePendingActivities();
  const [showAll, setShowAll] = useState(false);
  const permissions = usePermissions();
  
  const isAdmin = permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin;

  const handleActivityClick = (activity: PendingActivity) => {
    switch (activity.type) {
      case 'scorecard':
        // Open job with candidate sheet and scorecard tab
        window.open(
          `/jobs/${activity.jobId}?candidate=${activity.candidateId}&open=scorecard&stage=${activity.stageInstanceId}`,
          '_blank'
        );
        break;
      case 'decision':
        // Open job with candidate sheet
        window.open(
          `/jobs/${activity.jobId}?candidate=${activity.candidateId}`,
          '_blank'
        );
        break;
      case 'email':
        // Mark email as read and open candidate sheet with communications tab
        if (activity.emailId) {
          markEmailAsRead.mutate(activity.emailId);
        }
        window.open(
          `/jobs/${activity.jobId}?candidate=${activity.candidateId}&tab=communications`,
          '_blank'
        );
        break;
    }
  };

  const getBadgeVariant = (type: PendingActivity['type']) => {
    switch (type) {
      case 'scorecard':
        return 'secondary';
      case 'decision':
        return 'purple';
      case 'email':
        return 'default';
    }
  };

  const getBadgeLabel = (type: PendingActivity['type']) => {
    switch (type) {
      case 'scorecard':
        return 'Pending Scorecard';
      case 'decision':
        return 'Needs Decision';
      case 'email':
        return 'Email';
    }
  };

  const getActivityContent = (activity: PendingActivity) => {
    switch (activity.type) {
      case 'scorecard':
        return {
          title: activity.isOwnTask
            ? `Submit scorecard for ${activity.candidateName}`
            : `${activity.interviewerName} • Scorecard for ${activity.candidateName}`,
          subtitle: `${activity.jobTitle} • ${activity.stageName}`,
          timeLabel: 'Interview',
        };
      case 'decision':
        return {
          title: `Decide on ${activity.candidateName}`,
          subtitle: `${activity.jobTitle} • ${activity.stageName}`,
          timeLabel: 'Scorecard submitted',
        };
      case 'email':
        return {
          title: `Reply from ${activity.candidateName}`,
          subtitle: activity.emailSubject || 'No subject',
          timeLabel: 'Received',
        };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pending Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null; // Fail silently
  }

  const allActivities = activities || [];
  const displayedActivities = showAll ? allActivities : allActivities.slice(0, 5);
  const hasMore = allActivities.length > 5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Pending Tasks
          {allActivities.length > 0 && (
            <span className="ml-auto text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {allActivities.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <img src={gioFaceGreen} alt="All caught up" className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-poppins font-bold text-virgilio-text tracking-page-title">
              You're all caught up<span className="text-purple-period">.</span>
            </h3>
            <p className="text-sm text-virgilio-muted mt-2">
              {isAdmin ? 'No pending tasks in your organization' : 'No pending tasks'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedActivities.map((activity) => {
              const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });
              const hoursAgo = (Date.now() - new Date(activity.timestamp).getTime()) / (1000 * 60 * 60);
              const isUrgent = hoursAgo > 24;
              const content = getActivityContent(activity);

              return (
                <button
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all",
                    "hover:bg-accent hover:border-accent-foreground/20",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isUrgent ? "border-warning/50 bg-warning/5" : "border-border bg-card",
                    activity.type === 'scorecard' && !activity.isOwnTask && "opacity-80"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant={getBadgeVariant(activity.type)}>
                          {getBadgeLabel(activity.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {content.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="truncate">{content.subtitle}</span>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 mt-1.5 text-xs",
                        isUrgent ? "text-warning" : "text-muted-foreground"
                      )}>
                        <Clock className="h-3 w-3" />
                        <span>{content.timeLabel} {timeAgo}</span>
                      </div>
                    </div>
                    {activity.type === 'email' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <div className="p-1 rounded hover:bg-muted flex-shrink-0 mt-0.5 cursor-pointer">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => {
                            if (activity.emailId) markEmailAsRead.mutate(activity.emailId);
                          }}>
                            <CheckCheck className="h-4 w-4 mr-2" />
                            Mark as read
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleActivityClick(activity)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              );
            })}
            
            {hasMore && !showAll && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAll(true)}
              >
                Show {allActivities.length - 5} more
              </Button>
            )}
            
            {showAll && hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAll(false)}
              >
                Show less
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
