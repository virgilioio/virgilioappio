import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export type ScoreRating = "definitely_no" | "no" | "yes" | "strong_yes";

export interface ScorecardRow {
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
}

export function useMyScorecards(associationId?: string | null) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ScorecardRow[]>([]);

  const fetchMyScorecards = async () => {
    if (!associationId || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("job_stage_scorecards")
        .select("*")
        .eq("association_id", associationId)
        .eq("created_by", user.id);
      if (error) throw error;
      setRows(((data ?? []) as unknown) as ScorecardRow[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load scorecards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMyScorecards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [associationId, user?.id]);

  const byStage = useMemo(() => {
    const map: Record<string, ScorecardRow> = {};
    for (const r of rows) {
      map[r.stage_instance_id] = r;
    }
    return map;
  }, [rows]);

  const upsertMyScorecard = async (
    stageInstanceId: string,
    rating: ScoreRating,
    general_overview: string | null
  ) => {
    if (!associationId) throw new Error("Missing associationId");
    // Check existing
    const existing = rows.find((r) => r.stage_instance_id === stageInstanceId);
    if (existing) {
      const { data, error } = await (supabase as any)
        .from("job_stage_scorecards")
        .update({ rating, general_overview })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === existing.id ? ((data as unknown) as ScorecardRow) : r)));
      return (data as unknown) as ScorecardRow;
    } else {
      const { data, error } = await (supabase as any)
        .from("job_stage_scorecards")
        .insert([
          {
            association_id: associationId,
            stage_instance_id: stageInstanceId,
            rating,
            general_overview,
          },
        ])
        .select("*")
        .single();
      if (error) throw error;
      setRows((prev) => [...prev, ((data as unknown) as ScorecardRow)]);
      return (data as unknown) as ScorecardRow;
    }
  };

  return { loading, error, rows, byStage, refetch: fetchMyScorecards, upsertMyScorecard };
}
