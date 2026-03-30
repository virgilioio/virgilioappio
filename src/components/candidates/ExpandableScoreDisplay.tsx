import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SafeHtml } from "@/components/ui/safe-html";
import { ChevronRight, User, X } from "lucide-react";
import gioAiBannerIcon from "@/assets/gio-ai-banner-icon.png";
import { formatDistanceToNow } from "date-fns";
import type { ScorecardWithAuthor } from "@/hooks/useAllStageScorecards";
import type { ScoreRating } from "@/hooks/useScorecards";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExpandableScoreDisplayProps {
  scorecards: ScorecardWithAuthor[];
  currentUserId?: string;
  onOpenFullSheet?: (scorecardId: string) => void;
  onDismissAiDraft?: (scorecardId: string) => Promise<void>;
}

const ratingOptions = [
  { value: "definitely_no" as ScoreRating, label: "Definitely No", variant: "destructive" as const },
  { value: "no" as ScoreRating, label: "No", variant: "destructive" as const },
  { value: "yes" as ScoreRating, label: "Yes", variant: "default" as const },
  { value: "strong_yes" as ScoreRating, label: "Strong Yes", variant: "default" as const },
];

export function ExpandableScoreDisplay({ scorecards, currentUserId, onOpenFullSheet, onDismissAiDraft }: ExpandableScoreDisplayProps) {
  const [showDismissDialog, setShowDismissDialog] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const humanScorecards = scorecards.filter(s => !s.is_ai_draft);
  const hasAiDrafts = scorecards.some(s => s.is_ai_draft);
  const firstAiDraft = scorecards.find(s => s.is_ai_draft);

  const handleDismissAiDraft = async () => {
    if (!firstAiDraft || !onDismissAiDraft) return;
    setDismissing(true);
    try {
      await onDismissAiDraft(firstAiDraft.id);
    } finally {
      setDismissing(false);
      setShowDismissDialog(false);
    }
  };

  const getRatingConfig = (rating: ScoreRating) => {
    return ratingOptions.find(opt => opt.value === rating) || ratingOptions[0];
  };

  return (
    <div className="space-y-3">
      {/* AI Analysis Available indicator */}
      {hasAiDrafts && (
        <div
          className="rounded-lg bg-pastel-purple/30 border border-pastel-purple/50 cursor-pointer hover:bg-pastel-purple/40 transition-colors"
          onClick={() => firstAiDraft && onOpenFullSheet?.(firstAiDraft.id)}
        >
          <div className="p-3 flex items-start gap-3">
            <img src={gioAiBannerIcon} alt="Gio" className="h-10 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">AI Notes Analysis Available</p>
              <p className="text-xs text-muted-foreground">Click to review AI-generated insights</p>
            </div>
          </div>
        </div>
      )}

      {/* Human-submitted scorecards */}
      {humanScorecards.length === 0 && (
        <div className="text-sm text-text-tertiary">
          No scorecards submitted for this stage
        </div>
      )}

      {humanScorecards.map((scorecard) => {
        const isCurrentUser = scorecard.created_by === currentUserId;
        const ratingConfig = getRatingConfig(scorecard.rating);
        const hasFeedback = scorecard.general_overview?.trim();
        
        return (
          <div
            key={scorecard.id}
            className={`border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all ${isCurrentUser ? 'bg-accent/20 border-accent' : 'bg-card border-border'}`}
            onClick={() => onOpenFullSheet?.(scorecard.id)}
          >
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
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {hasFeedback && (
              <div className="mt-2 pl-6">
                <div className="text-xs text-muted-foreground line-clamp-2">
                  <SafeHtml 
                    content={scorecard.general_overview} 
                    className="text-xs prose prose-sm max-w-none"
                  />
                </div>
              </div>
            )}

            {!hasFeedback && (
              <div className="text-xs text-text-tertiary mt-2 pl-6">
                No feedback provided
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}