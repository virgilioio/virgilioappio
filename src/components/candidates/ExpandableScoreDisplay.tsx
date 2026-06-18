import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SafeHtml } from "@/components/ui/safe-html";
import { ChevronRight, User, X, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ScorecardWithAuthor } from "@/hooks/useAllStageScorecards";
import type { ScoreRating } from "@/hooks/useScorecards";

interface ExpandableScoreDisplayProps {
  scorecards: ScorecardWithAuthor[];
  currentUserId?: string;
  stageInstanceId?: string;
  onOpenFullSheet?: (scorecardId: string) => void;
  /** Kept for API compatibility; the new banner uses a soft per-user+stage dismissal. */
  onDismissAiDraft?: (scorecardId: string) => Promise<void>;
}

const ratingOptions = [
  { value: "definitely_no" as ScoreRating, label: "Definitely No", variant: "destructive" as const },
  { value: "no" as ScoreRating, label: "No", variant: "destructive" as const },
  { value: "yes" as ScoreRating, label: "Yes", variant: "default" as const },
  { value: "strong_yes" as ScoreRating, label: "Strong Yes", variant: "default" as const },
];

function dismissalKey(userId: string | undefined, stageId: string | undefined, draftId: string) {
  return `gio.notesAnalysis.dismissed:${userId || "anon"}:${stageId || "x"}:${draftId}`;
}

export function ExpandableScoreDisplay({
  scorecards,
  currentUserId,
  stageInstanceId,
  onOpenFullSheet,
}: ExpandableScoreDisplayProps) {
  const humanScorecards = scorecards.filter((s) => !s.is_ai_draft);
  const firstAiDraft = scorecards.find((s) => s.is_ai_draft);

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!firstAiDraft) return;
    try {
      setDismissed(
        localStorage.getItem(dismissalKey(currentUserId, stageInstanceId, firstAiDraft.id)) === "1"
      );
    } catch {
      setDismissed(false);
    }
  }, [firstAiDraft?.id, currentUserId, stageInstanceId]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firstAiDraft) return;
    try {
      localStorage.setItem(
        dismissalKey(currentUserId, stageInstanceId, firstAiDraft.id),
        "1",
      );
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const getRatingConfig = (rating: ScoreRating) =>
    ratingOptions.find((opt) => opt.value === rating) || ratingOptions[0];

  const showBanner = !!firstAiDraft && !dismissed;

  return (
    <div className="space-y-3">
      {/* Lilac emphasis: Gio notes-analysis banner */}
      {showBanner && (
        <div
          className="relative flex items-center gap-[14px] rounded-[14px] px-4 py-[15px]"
          style={{
            background: "#EDE4FF",
            border: "1px solid #DCC9FA",
          }}
        >
          {/* Logo tile with Gio ATS mark */}
          <div
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] bg-white"
            style={{ boxShadow: "0 1px 2px rgba(91,33,182,0.12)" }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
              <circle cx="24" cy="19.4" r="9.9" fill="#0d0d09" />
              <rect x="20.7" y="29.9" width="13.2" height="8.8" rx="4.4" fill="#D7C5FB" />
            </svg>
          </div>

          {/* Copy */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="font-poppins"
                style={{ fontSize: 14, fontWeight: 600, color: "#3B1E78" }}
              >
                Notes analysis ready
              </span>
              <span
                className="font-inter"
                style={{
                  fontWeight: 700,
                  fontSize: "9.5px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#6F3FF5",
                  background: "#fff",
                  border: "1px solid #DCC9FA",
                  borderRadius: 999,
                  padding: "2px 7px",
                  lineHeight: 1,
                }}
              >
                Gio
              </span>
            </div>
            <p
              className="font-inter"
              style={{
                marginTop: 3,
                fontSize: 12,
                color: "#5B21B6",
                opacity: 0.85,
              }}
            >
              Themes, strengths, and concerns synthesized from all submitted scorecards.
            </p>
          </div>

          {/* Primary action */}
          <button
            type="button"
            onClick={() => firstAiDraft && onOpenFullSheet?.(firstAiDraft.id)}
            className="font-poppins inline-flex shrink-0 items-center gap-[6px] rounded-lg"
            style={{
              background: "#0d0d09",
              color: "#fffcf9",
              height: 28,
              padding: "0 10px",
              fontWeight: 500,
              fontSize: 12,
            }}
          >
            <Sparkles size={13} />
            Review insights
          </button>

          {/* Dismiss */}
          <button
            type="button"
            aria-label="Dismiss notes analysis"
            onClick={handleDismiss}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-transparent hover:bg-white/40 transition-colors"
            style={{ color: "#7C5BC2" }}
          >
            <X size={15} />
          </button>
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
            className={`border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all ${isCurrentUser ? "bg-accent/20 border-accent" : "bg-card border-border"}`}
            onClick={() => onOpenFullSheet?.(scorecard.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-text-tertiary" />
                <span className="text-sm font-medium">
                  {isCurrentUser ? "Your score" : scorecard.author_name || "Team Member"}
                </span>
                <span className="text-xs text-text-tertiary">
                  {formatDistanceToNow(new Date(scorecard.created_at), { addSuffix: true })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={ratingConfig.variant}>{ratingConfig.label}</Badge>
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
              <div className="text-xs text-text-tertiary mt-2 pl-6">No feedback provided</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
