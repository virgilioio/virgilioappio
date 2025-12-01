import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Calendar, UserCheck, UserX, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import type { ScoreRating } from "@/hooks/useScorecards";

interface NextStepRecommendation {
  action: string;
  reasoning: string;
  priority: "high" | "medium" | "low";
  suggested_stage?: string;
}

interface RecommendedNextStepsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scorecardId: string;
  candidateId: string;
  jobId: string;
  rating: ScoreRating;
  overview: string | null;
  candidateName?: string;
  onMoveToNextStage?: () => void;
  onScheduleFollowUp?: () => void;
  onReject?: () => void;
}

const ratingLabels: Record<ScoreRating, string> = {
  definitely_no: "Definitely No",
  no: "No",
  yes: "Yes",
  strong_yes: "Strong Yes",
};

export function RecommendedNextStepsDialog({
  open,
  onOpenChange,
  scorecardId,
  candidateId,
  jobId,
  rating,
  overview,
  candidateName,
  onMoveToNextStage,
  onScheduleFollowUp,
  onReject,
}: RecommendedNextStepsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<NextStepRecommendation[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-next-steps", {
        body: {
          scorecard_id: scorecardId,
          candidate_id: candidateId,
          job_id: jobId,
          rating,
          overview,
        },
      });

      if (error) throw error;

      setRecommendations(data.recommendations || []);
      setHasGenerated(true);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      toast({
        title: "Error",
        description: "Failed to generate recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: string) => {
    switch (action.toLowerCase()) {
      case "move to next stage":
      case "advance":
        onMoveToNextStage?.();
        onOpenChange(false);
        break;
      case "schedule follow-up":
      case "schedule":
        onScheduleFollowUp?.();
        onOpenChange(false);
        break;
      case "reject":
        onReject?.();
        onOpenChange(false);
        break;
      default:
        toast({
          title: "Action",
          description: `Consider: ${action}`,
        });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getActionIcon = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes("next") || lowerAction.includes("advance")) {
      return <ArrowRight className="h-4 w-4" />;
    }
    if (lowerAction.includes("schedule") || lowerAction.includes("follow")) {
      return <Calendar className="h-4 w-4" />;
    }
    if (lowerAction.includes("offer") || lowerAction.includes("hire")) {
      return <UserCheck className="h-4 w-4" />;
    }
    if (lowerAction.includes("reject")) {
      return <UserX className="h-4 w-4" />;
    }
    return <ArrowRight className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Recommended Next Steps
          </DialogTitle>
          <DialogDescription>
            AI-powered suggestions based on the interview scorecard
            {candidateName && ` for ${candidateName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Rating Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Current Rating:</span>
            <Badge
              variant="outline"
              className={
                rating === "strong_yes" || rating === "yes"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              }
            >
              {ratingLabels[rating]}
            </Badge>
          </div>

          {/* Generate Button or Recommendations */}
          {!hasGenerated ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Get AI-powered recommendations for the next steps with this candidate
              </p>
              <Button onClick={generateRecommendations} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Recommendations
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No specific recommendations at this time. Consider reviewing the scorecard notes.
                </p>
              ) : (
                recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg space-y-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getActionIcon(rec.action)}
                        <span className="font-medium">{rec.action}</span>
                      </div>
                      <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleAction(rec.action)}
                    >
                      Take Action
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
