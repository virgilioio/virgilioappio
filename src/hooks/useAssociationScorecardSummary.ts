import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { ScoreRating } from "./useScorecards";

export interface ScorecardSummary {
  counts: { strong_yes: number; yes: number; no: number; definitely_no: number };
  filledCount: number;
  panelistCount: number;
  /** Average on a 4-point scale. Null when no submitted scorecards. */
  average: number | null;
  loading: boolean;
  error: string | null;
}

const RATING_SCORE: Record<ScoreRating, number> = {
  strong_yes: 4,
  yes: 3,
  no: 2,
  definitely_no: 1,
};

export function useAssociationScorecardSummary(
  associationId?: string | null,
  refreshKey?: number | string,
): ScorecardSummary {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ strong_yes: 0, yes: 0, no: 0, definitely_no: 0 });
  const [panelistCount, setPanelistCount] = useState(0);
  const [average, setAverage] = useState<number | null>(null);

  const isAdminOrRecruiter =
    permissions.isAdmin ||
    permissions.isPlatformAdmin ||
    !!(permissions as any).isWorkspaceOwner ||
    !!(permissions as any).canManageMembers;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!associationId) {
        setCounts({ strong_yes: 0, yes: 0, no: 0, definitely_no: 0 });
        setPanelistCount(0);
        setAverage(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("job_stage_scorecards")
          .select("created_by, rating, is_ai_draft")
          .eq("association_id", associationId)
          .not("rating", "is", null);

        if (!isAdminOrRecruiter && user?.id) {
          query = query.eq("created_by", user.id);
        }

        const { data, error: qErr } = await query;
        if (qErr) throw qErr;
        if (cancelled) return;

        const next = { strong_yes: 0, yes: 0, no: 0, definitely_no: 0 };
        const panelists = new Set<string>();
        let sum = 0;
        let n = 0;

        for (const row of data || []) {
          if ((row as any).is_ai_draft) continue;
          const rating = (row as any).rating as ScoreRating | null;
          if (!rating || !(rating in next)) continue;
          next[rating] += 1;
          sum += RATING_SCORE[rating];
          n += 1;
          if ((row as any).created_by) panelists.add((row as any).created_by);
        }

        setCounts(next);
        setPanelistCount(panelists.size);
        setAverage(n > 0 ? Math.round((sum / n) * 10) / 10 : null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load scorecard summary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [associationId, user?.id, isAdminOrRecruiter, refreshKey]);

  const filledCount = counts.strong_yes + counts.yes + counts.no + counts.definitely_no;

  return { counts, filledCount, panelistCount, average, loading, error };
}
