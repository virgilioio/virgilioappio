import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePendingActivities, PendingActivity } from '@/hooks/usePendingActivities';
import { useStaleCandidates, StaleCandidate } from '@/hooks/useStaleCandidates';
import { ChevronRight, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import gioFaceGreen from '@/assets/gio-face-green.png';

type CategoryKey = 'scorecard' | 'decision' | 'email' | 'offer_approval' | 'stale';

interface CategoryConfig {
  key: CategoryKey;
  label: string;
  color: string;
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'scorecard', label: 'Pending Scorecards', icon: ClipboardCheck, badgeVariant: 'status-invited', color: 'text-amber-600 dark:text-amber-400' },
  { key: 'decision', label: 'Needs Decision', icon: Scale, badgeVariant: 'pipeline-offer', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'email', label: 'Unread Emails', icon: Mail, badgeVariant: 'status-active', color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'offer_approval', label: 'Offer Approvals', icon: FileCheck, badgeVariant: 'role-recruiter', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'stale', label: 'Stale Candidates', icon: AlertTriangle, badgeVariant: 'warning', color: 'text-orange-600 dark:text-orange-400' },
];

export function TasksOverview() {
  const { data: activities, isLoading: activitiesLoading, markEmailAsRead } = usePendingActivities();
  const { data: staleCandidates, isLoading: staleLoading } = useStaleCandidates();
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>(null);

  const isLoading = activitiesLoading || staleLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold" withPeriod={false}>Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Group activities by type
  const grouped = (activities || []).reduce<Record<string, PendingActivity[]>>((acc, a) => {
    (acc[a.type] ??= []).push(a);
    return acc;
  }, {});

  const counts: Record<CategoryKey, number> = {
    scorecard: grouped.scorecard?.length ?? 0,
    decision: grouped.decision?.length ?? 0,
    email: grouped.email?.length ?? 0,
    offer_approval: grouped.offer_approval?.length ?? 0,
    stale: staleCandidates?.length ?? 0,
  };

  const visibleCategories = CATEGORIES.filter(c => counts[c.key] > 0);
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const handleActivityClick = (activity: PendingActivity) => {
    switch (activity.type) {
      case 'scorecard':
        window.open(`/jobs/${activity.jobId}?candidate=${activity.candidateId}&open=scorecard&stage=${activity.stageInstanceId}`, '_blank');
        break;
      case 'decision':
        window.open(`/jobs/${activity.jobId}?candidate=${activity.candidateId}`, '_blank');
        break;
      case 'email':
        if (activity.emailId) markEmailAsRead.mutate(activity.emailId);
        window.open(`/jobs/${activity.jobId}?candidate=${activity.candidateId}&tab=communications`, '_blank');
        break;
      case 'offer_approval':
        window.open(`/jobs/${activity.jobId}?candidate=${activity.candidateId}&tab=offer`, '_blank');
        break;
    }
  };

  const handleStaleClick = (candidate: StaleCandidate) => {
    window.open(`/jobs/${candidate.jobId}?candidate=${candidate.candidateId}`, '_blank');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2" withPeriod={false}>
            Tasks
            {totalCount > 0 && (
              <span className="ml-auto text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {totalCount}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visibleCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <img src={gioFaceGreen} alt="All caught up" className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-poppins font-bold text-virgilio-text tracking-page-title">
                You're all caught up<span className="text-purple-period">.</span>
              </h3>
              <p className="text-sm text-virgilio-muted mt-2">No pending tasks</p>
            </div>
          ) : (
            <div className="space-y-1">
              {visibleCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setOpenCategory(cat.key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                      "text-left group"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0", cat.color)} />
                    <span className="text-sm font-medium text-foreground flex-1">{cat.label}</span>
                    <span className={cn(
                      "text-xs font-semibold min-w-[1.5rem] h-5 flex items-center justify-center rounded-full px-1.5",
                      cat.key === 'stale'
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        : cat.key === 'scorecard'
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : cat.key === 'decision'
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : cat.key === 'email'
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    )}>
                      {counts[cat.key]}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialogs */}
      <Dialog open={openCategory !== null && openCategory !== 'stale'} onOpenChange={(open) => !open && setOpenCategory(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {openCategory && openCategory !== 'stale' && CATEGORIES.find(c => c.key === openCategory)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {openCategory && openCategory !== 'stale' && (grouped[openCategory] || []).map((activity) => (
              <ActivityRow key={activity.id} activity={activity} onClick={() => handleActivityClick(activity)} />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openCategory === 'stale'} onOpenChange={(open) => !open && setOpenCategory(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stale Candidates</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {(staleCandidates || []).map((candidate) => (
              <StaleCandidateRow key={candidate.associationId} candidate={candidate} onClick={() => handleStaleClick(candidate)} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActivityRow({ activity, onClick }: { activity: PendingActivity; onClick: () => void }) {
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });

  const getTitle = () => {
    switch (activity.type) {
      case 'scorecard':
        return activity.isOwnTask
          ? `Submit scorecard for ${activity.candidateName}`
          : `${activity.interviewerName} • ${activity.candidateName}`;
      case 'decision':
        return `Decide on ${activity.candidateName}`;
      case 'email':
        return `Reply from ${activity.candidateName}`;
      case 'offer_approval':
        return `Approve offer for ${activity.candidateName}`;
    }
  };

  const getSubtitle = () => {
    switch (activity.type) {
      case 'scorecard':
      case 'decision':
        return `${activity.jobTitle} • ${activity.stageName || 'Stage'}`;
      case 'email':
        return activity.emailSubject || 'No subject';
      case 'offer_approval':
        return activity.jobTitle;
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border border-border transition-all",
        "hover:bg-accent hover:border-accent-foreground/20",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{getTitle()}</span>
          <span className="text-xs text-muted-foreground truncate block mt-0.5">{getSubtitle()}</span>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

function StaleCandidateRow({ candidate, onClick }: { candidate: StaleCandidate; onClick: () => void }) {
  const isCritical = candidate.daysSinceLastActivity >= 14;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        "hover:bg-accent hover:border-accent-foreground/20",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isCritical ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{candidate.candidateName}</span>
          <span className="text-xs text-muted-foreground truncate block mt-0.5">
            {candidate.jobTitle} • {candidate.stageName}
          </span>
          <div className={cn(
            "flex items-center gap-1 mt-1 text-xs font-medium",
            isCritical ? "text-destructive" : "text-warning"
          )}>
            <Clock className="h-3 w-3" />
            <span>{candidate.daysSinceLastActivity} days since last activity</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}
