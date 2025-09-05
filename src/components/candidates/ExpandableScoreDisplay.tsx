import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SafeHtml } from "@/components/ui/safe-html";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ScorecardWithAuthor } from "@/hooks/useAllStageScorecards";
import type { ScoreRating } from "@/hooks/useScorecards";

interface ExpandableScoreDisplayProps {
  scorecards: ScorecardWithAuthor[];
  currentUserId?: string;
  onOpenFullSheet?: () => void;
}

const ratingOptions = [
  { value: "definitely_no" as ScoreRating, label: "Definitely No", variant: "destructive" as const },
  { value: "no" as ScoreRating, label: "No", variant: "destructive" as const },
  { value: "yes" as ScoreRating, label: "Yes", variant: "default" as const },
  { value: "strong_yes" as ScoreRating, label: "Strong Yes", variant: "default" as const },
];

export function ExpandableScoreDisplay({ scorecards, currentUserId, onOpenFullSheet }: ExpandableScoreDisplayProps) {
  const [expandedScorecard, setExpandedScorecard] = useState<string | null>(null);

  if (!scorecards.length) {
    return (
      <div className="text-sm text-text-tertiary">
        No scorecards submitted for this stage
      </div>
    );
  }

  const toggleExpanded = (scorecardId: string) => {
    setExpandedScorecard(expandedScorecard === scorecardId ? null : scorecardId);
  };

  const getRatingConfig = (rating: ScoreRating) => {
    return ratingOptions.find(opt => opt.value === rating) || ratingOptions[0];
  };

  return (
    <div className="space-y-3">
      {scorecards.map((scorecard) => {
        const isCurrentUser = scorecard.created_by === currentUserId;
        const isExpanded = expandedScorecard === scorecard.id;
        const ratingConfig = getRatingConfig(scorecard.rating);
        const hasFeedback = scorecard.general_overview?.trim();
        
        return (
          <div key={scorecard.id} className={`border rounded-lg p-3 ${isCurrentUser ? 'bg-accent/20 border-accent' : 'bg-card border-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-text-tertiary" />
                <span className="text-sm font-medium">
                  {isCurrentUser ? "Your score" : (scorecard.author_name || "Team Member")}
                </span>
                <span className="text-xs text-text-tertiary">
                  {formatDistanceToNow(new Date(scorecard.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={ratingConfig.variant}>
                  {ratingConfig.label}
                </Badge>
                
                {hasFeedback && (
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(scorecard.id)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                )}
              </div>
            </div>

            {hasFeedback && (
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(scorecard.id)}>
                <CollapsibleContent className="mt-3">
                  <div className="pl-6 border-l-2 border-border">
                    <div className="text-sm text-text-tertiary mb-1">Feedback:</div>
                    <SafeHtml 
                      content={scorecard.general_overview} 
                      className="text-sm prose prose-sm max-w-none"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {!hasFeedback && (
              <div className="text-xs text-text-tertiary mt-2 pl-6">
                No feedback provided
              </div>
            )}
          </div>
        );
      })}

      {onOpenFullSheet && (
        <Button variant="outline" size="sm" onClick={onOpenFullSheet} className="mt-2">
          Open Scorecard
        </Button>
      )}
    </div>
  );
}