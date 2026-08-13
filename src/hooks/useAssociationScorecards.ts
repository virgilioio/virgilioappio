import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { ScoreRating } from "./useScorecards";
import type { ScorecardVisibility } from "./useScorecardsConfiguration";
import type { ScorecardCriterionScore, ScorecardWithAuthor } from "./useAllStageScorecards";

/**
 * Fetches every scorecard for an application (all stages, not just the current one)
 * so that scorecards submitted in earlier stages remain visible after the
 * candidate advances. Visibility rules are applied per-stage, exactly like
 * `useAllStageScorecards`.
 */
export function useAssociationScorecards(
  associationId?: string | null,
  refreshKey?: number | string,
) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scorecards, setScorecards] = useState<ScorecardWithAuthor[]>([]);

  const isAdminOrRecruiter =
    permissions.isAdmin ||
    permissions.isPlatformAdmin ||
    !!(permissions as any).isWorkspaceOwner ||
    !!(permissions as any).canManageMembers;

  const fetchAll = async () => {
    if (!associationId) {
      setScorecards([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: scorecardsData, error: scorecardsError } = await supabase
        .from("job_stage_scorecards")
        .select("*")
        .eq("association_id", associationId)
        .order("created_at", { ascending: false });
      if (scorecardsError) throw scorecardsError;

      const rows = (scorecardsData || []) as any[];
      const scorecardIds = rows.map((s) => s.id);
      const stageIds = Array.from(new Set(rows.map((s) => s.stage_instance_id).filter(Boolean)));

      // Per-stage visibility
      const visibilityByStage: Record<string, ScorecardVisibility> = {};
      if (stageIds.length > 0) {
        const { data: templates } = await supabase
          .from("stage_scorecard_templates")
          .select("job_hiring_stage_id, visibility")
          .in("job_hiring_stage_id", stageIds);
        for (const t of (templates || []) as any[]) {
          visibilityByStage[t.job_hiring_stage_id] =
            (t.visibility as ScorecardVisibility) || "private";
        }
      }

      // Per-criterion (score_1_5) responses in one batch
      const responsesByScorecard: Record<string, ScorecardCriterionScore[]> = {};
      if (scorecardIds.length > 0) {
        const { data: respData } = await supabase
          .from("scorecard_question_responses")
          .select(
            "scorecard_id, question_id, answer_text, scorecard_interview_questions(question_text, answer_type)",
          )
          .in("scorecard_id", scorecardIds);
        for (const row of (respData || []) as any[]) {
          const q = row.scorecard_interview_questions;
          if (!q || q.answer_type !== "score_1_5" || !row.answer_text) continue;
          (responsesByScorecard[row.scorecard_id] ||= []).push({
            questionId: row.question_id,
            questionText: q.question_text,
            rating: row.answer_text as ScoreRating,
          });
        }
      }

      // Author info (one lookup per distinct user)
      const authorIds = Array.from(new Set(rows.map((s) => s.created_by).filter(Boolean)));
      const authorById: Record<string, { name: string | null; email: string | null }> = {};
      await Promise.all(
        authorIds.map(async (uid) => {
          try {
            const { data } = await supabase.rpc("get_member_display_info", {
              member_user_id: uid,
            });
            const a = (data as any)?.[0];
            authorById[uid] = {
              name: a?.first_name && a?.last_name ? `${a.first_name} ${a.last_name}` : null,
              email: a?.email || null,
            };
          } catch {
            authorById[uid] = { name: null, email: null };
          }
        }),
      );

      const withAuthors = rows.map((s) => ({
        ...s,
        author_name: authorById[s.created_by]?.name ?? null,
        author_email: authorById[s.created_by]?.email ?? null,
        criterion_scores: responsesByScorecard[s.id] || [],
      })) as ScorecardWithAuthor[];

      const filtered = withAuthors.filter((s) => {
        if (isAdminOrRecruiter) return true;
        const vis = visibilityByStage[s.stage_instance_id] || "private";
        return vis === "public" || s.created_by === user?.id;
      });

      setScorecards(filtered);
    } catch (e: any) {
      setError(e?.message || "Failed to load scorecards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [associationId, user?.id, refreshKey]);

  return { loading, error, scorecards, refetch: fetchAll };
}
