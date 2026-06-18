import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { ScoreRating } from "./useScorecards";
import { RATING_META, coerceRating } from "@/lib/scorecardRatings";

export interface ScorecardSummary {
  counts: { strong_yes: number; yes: number; lean_yes: number; lean_no: number; strong_no: number };
  filledCount: number;
  panelistCount: number;
  /** Average on a 5-point scale. Null when no submitted scorecards. */
  average: number | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_COUNTS = { strong_yes: 0, yes: 0, lean_yes: 0, lean_no: 0, strong_no: 0 };

export function useAssociationScorecardSummary(
  associationId?: string | null,
  refreshKey?: number | string,
): ScorecardSummary {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ ...EMPTY_COUNTS });
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
        setCounts({ ...EMPTY_COUNTS });
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

        const next = { ...EMPTY_COUNTS };
        const panelists = new Set<string>();
        let sum = 0;
        let n = 0;

        for (const row of data || []) {
          if ((row as any).is_ai_draft) continue;
          const rating = coerceRating((row as any).rating);
          if (!rating) continue;
          next[rating] += 1;
          sum += RATING_META[rating].numeric;
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

  const filledCount =
    counts.strong_yes + counts.yes + counts.lean_yes + counts.lean_no + counts.strong_no;

  return { counts, filledCount, panelistCount, average, loading, error };
}
