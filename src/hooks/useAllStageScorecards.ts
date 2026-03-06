import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { ScoreRating } from "./useScorecards";
import type { ScorecardVisibility } from "./useScorecardsConfiguration";

export interface ScorecardWithAuthor {
  id: string;
  association_id: string;
  stage_instance_id: string;
  job_id: string;
  candidate_id: string;
  created_by: string;
  rating: ScoreRating;
  general_overview: string | null;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_email: string | null;
  // AI draft fields
  is_ai_draft?: boolean;
  ai_suggested_rating?: string | null;
  source_booking_id?: string | null;
}

export function useAllStageScorecards(stageInstanceId?: string | null, associationId?: string | null) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scorecards, setScorecards] = useState<ScorecardWithAuthor[]>([]);

  const fetchAllScorecards = async () => {
    if (!stageInstanceId || !associationId) return;
    setLoading(true);
    setError(null);
    try {
      // First get all scorecards for this stage and association
      const { data: scorecardsData, error: scorecardsError } = await supabase
        .from("job_stage_scorecards")
        .select("*")
        .eq("stage_instance_id", stageInstanceId)
        .eq("association_id", associationId)
        .order("created_at", { ascending: false });

      if (scorecardsError) throw scorecardsError;

      // Get author information for each scorecard
      const scorecardsWithAuthors = await Promise.all(
        (scorecardsData || []).map(async (scorecard) => {
          try {
            const { data: authorData } = await supabase.rpc(
              "get_member_display_info", 
              { member_user_id: scorecard.created_by }
            );
            
            return {
              ...scorecard,
              author_name: authorData?.[0]?.first_name && authorData?.[0]?.last_name 
                ? `${authorData[0].first_name} ${authorData[0].last_name}` 
                : null,
              author_email: authorData?.[0]?.email || null,
            } as ScorecardWithAuthor;
          } catch {
            // Fallback if author info fails
            return {
              ...scorecard,
              author_name: null,
              author_email: null,
            } as ScorecardWithAuthor;
          }
        })
      );

      setScorecards(scorecardsWithAuthors);
    } catch (e: any) {
      setError(e?.message || "Failed to load scorecards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllScorecards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageInstanceId, associationId, user?.id]);

  return { loading, error, scorecards, refetch: fetchAllScorecards };
}