import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ScoreRating } from "./useScorecards";

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
}

export function useAllStageScorecards(stageInstanceId?: string | null) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scorecards, setScorecards] = useState<ScorecardWithAuthor[]>([]);

  const fetchAllScorecards = async () => {
    if (!stageInstanceId) return;
    setLoading(true);
    setError(null);
    try {
      // First get all scorecards for this stage
      const { data: scorecardsData, error: scorecardsError } = await supabase
        .from("job_stage_scorecards")
        .select("*")
        .eq("stage_instance_id", stageInstanceId)
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
  }, [stageInstanceId, user?.id]);

  return { loading, error, scorecards, refetch: fetchAllScorecards };
}