import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePendingScorecards, PendingScorecard } from '@/hooks/usePendingScorecards';
import { ClipboardList, Clock, ChevronRight, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import gioFaceGreen from '@/assets/gio-face-green.png';
import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export function MyTasks() {
  const navigate = useNavigate();
  const { data: pendingScorecards, isLoading, error } = usePendingScorecards();
  const [showAll, setShowAll] = useState(false);
  const permissions = usePermissions();
  
  const isAdmin = permissions.isAdmin || permissions.isWorkspaceOwner || permissions.isPlatformAdmin;

  const handleTaskClick = (task: PendingScorecard) => {
    // Navigate to job with candidate profile sheet and scorecard for specific stage
    navigate(`/jobs/${task.jobId}?candidate=${task.candidateId}&open=scorecard&stage=${task.stageInstanceId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {isAdmin ? <Users className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
            {isAdmin ? 'Pending Scorecards' : 'My Tasks'}
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

  const tasks = pendingScorecards || [];
  const displayedTasks = showAll ? tasks : tasks.slice(0, 5);
  const hasMore = tasks.length > 5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {isAdmin ? <Users className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
          {isAdmin ? 'Pending Scorecards' : 'My Tasks'}
          {tasks.length > 0 && (
            <span className="ml-auto text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <img src={gioFaceGreen} alt="All caught up" className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-poppins font-bold text-virgilio-text tracking-page-title">
              You're all caught up<span className="text-purple-period">.</span>
            </h3>
            <p className="text-sm text-virgilio-muted mt-2">
              {isAdmin ? 'No pending scorecards in your organization' : 'No pending scorecards to submit'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedTasks.map((task) => {
              const timeAgo = formatDistanceToNow(new Date(task.scheduledStart), { addSuffix: true });
              const hoursAgo = (Date.now() - new Date(task.scheduledStart).getTime()) / (1000 * 60 * 60);
              const isUrgent = hoursAgo > 24;

              return (
                <button
                  key={task.bookingId}
                  onClick={() => handleTaskClick(task)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all",
                    "hover:bg-accent hover:border-accent-foreground/20",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isUrgent ? "border-warning/50 bg-warning/5" : "border-border bg-card",
                    !task.isOwnTask && "opacity-80"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {task.isOwnTask ? (
                            <>Submit scorecard for {task.candidateName}</>
                          ) : (
                            <>{task.interviewerName} • Scorecard for {task.candidateName}</>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="truncate">{task.jobTitle}</span>
                        <span>•</span>
                        <span>{task.stageName}</span>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 mt-1.5 text-xs",
                        isUrgent ? "text-warning" : "text-muted-foreground"
                      )}>
                        <Clock className="h-3 w-3" />
                        <span>Interview {timeAgo}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
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
                Show {tasks.length - 5} more
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
