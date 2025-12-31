import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStaleCandidates, StaleCandidate } from '@/hooks/useStaleCandidates';
import { Clock, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import gioFaceGreen from '@/assets/gio-face-green.png';

export function StaleCandidates() {
  const navigate = useNavigate();
  const { data: staleCandidates, isLoading, error } = useStaleCandidates();
  const [showAll, setShowAll] = useState(false);

  const handleCandidateClick = (candidate: StaleCandidate) => {
    navigate(`/jobs/${candidate.jobId}?candidate=${candidate.candidateId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Stale Candidates
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

  const candidates = staleCandidates || [];
  const displayedCandidates = showAll ? candidates : candidates.slice(0, 5);
  const hasMore = candidates.length > 5;

  // Determine urgency level based on days in stage
  const getUrgencyLevel = (days: number): 'warning' | 'critical' => {
    return days >= 14 ? 'critical' : 'warning';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Stale Candidates
          {candidates.length > 0 && (
            <span className="ml-auto text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {candidates.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <img src={gioFaceGreen} alt="Pipeline moving" className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-poppins font-bold text-virgilio-text tracking-page-title">
              Pipeline is moving<span className="text-purple-period">.</span>
            </h3>
            <p className="text-sm text-virgilio-muted mt-2">
              No candidates stuck in stages for over 7 days
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedCandidates.map((candidate) => {
              const urgency = getUrgencyLevel(candidate.daysInStage);
              const isCritical = urgency === 'critical';

              return (
                <button
                  key={candidate.associationId}
                  onClick={() => handleCandidateClick(candidate)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all",
                    "hover:bg-accent hover:border-accent-foreground/20",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isCritical 
                      ? "border-destructive/50 bg-destructive/5" 
                      : "border-warning/50 bg-warning/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {candidate.candidateName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="truncate">{candidate.jobTitle}</span>
                        <span>•</span>
                        <span>{candidate.stageName}</span>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 mt-1.5 text-xs font-medium",
                        isCritical ? "text-destructive" : "text-warning"
                      )}>
                        <Clock className="h-3 w-3" />
                        <span>{candidate.daysInStage} days in stage</span>
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
                Show {candidates.length - 5} more
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
