
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../utils/createSecureEdgeFunction.ts";

const corsHeaders = createSecureCorsHeaders();

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""; // optional for auth.getUser()
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

type TargetTable = "candidates" | "job_candidates" | "jobs";

interface BackfillRequest {
  table?: TargetTable | "all";
  batch_size?: number;
  dry_run?: boolean;
  ai_enrich?: boolean; // if true, use AI to canonicalize missing items
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

async function requirePlatformAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !ANON_KEY) {
    return { ok: false, reason: "Missing auth token" };
  }

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await authClient.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, reason: "Not authenticated" };
  }

  const userType = (data.user.user_metadata as any)?.user_type || (data.user.app_metadata as any)?.user_type;
  if (userType !== "platform_admin") {
    return { ok: false, reason: "Forbidden (platform_admin only)" };
  }

  return { ok: true, userId: data.user.id };
}

async function mapCanonicalWithStandardSkills(supabaseSr: any, names: string[]) {
  if (names.length === 0) return [];

  const lower = unique(names.map(n => n.toLowerCase()));
  // Try by canonical_name
  const { data: byCanonical } = await supabaseSr
    .from("standard_skills")
    .select("canonical_name")
    .in("canonical_name", unique(names));

  const canonicalSet = new Set<string>((byCanonical || []).map((r: any) => r.canonical_name as string));

  // Try by synonyms overlap
  const { data: bySyn } = await supabaseSr
    .from("standard_skills")
    .select("canonical_name,synonyms")
    .overlaps("synonyms", lower);

  (bySyn || []).forEach((r: any) => canonicalSet.add(r.canonical_name));

  // Add any remaining raw names if we couldn't map them
  names.forEach(n => {
    if (![...canonicalSet].some(c => c.toLowerCase() === n.toLowerCase())) {
      canonicalSet.add(n);
    }
  });

  return Array.from(canonicalSet);
}

async function aiCanonicalize(list: string[]): Promise<string[]> {
  if (!OPENAI_API_KEY || list.length === 0) return list;
  const prompt = `Normalize the following skill/industry names to concise English canonical terms.
Return ONLY a JSON array of strings.
Input: ${JSON.stringify(list)}`;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You standardize skill and industry names to English canonical labels." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });
    if (!resp.ok) return list;
    const data = await resp.json();
    const content = (data.choices?.[0]?.message?.content || "").trim();
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const arr = JSON.parse(jsonMatch ? jsonMatch[1] : content);
      return Array.isArray(arr) ? unique(arr.map((s: any) => String(s))) : list;
    } catch {
      return list;
    }
  } catch {
    return list;
  }
}

async function backfillTable(supabaseSr: any, table: TargetTable, batchSize: number, dryRun: boolean, aiEnrich: boolean) {
  // Select rows with missing or empty standardized_skills
  const { data: rows, error } = await supabaseSr
    .from(table)
    .select('id, skills, standardized_skills')
    .or('standardized_skills.is.null,cardinality(standardized_skills).eq.0')
    .limit(batchSize);

  if (error) throw new Error(`Select error on ${table}: ${error.message}`);
  if (!rows || rows.length === 0) return { processed: 0, updated: 0 };

  let updated = 0;
  for (const r of rows as any[]) {
    const skills: string[] = Array.isArray(r.skills) ? r.skills : [];
    if (skills.length === 0) continue;

    // Map via standard_skills
    let canonical = await mapCanonicalWithStandardSkills(supabaseSr, skills);

    // Optionally AI-normalize
    if (aiEnrich) {
      canonical = await aiCanonicalize(canonical);
    }

    if (!dryRun) {
      const { error: upError } = await supabaseSr
        .from(table)
        .update({ standardized_skills: canonical, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (upError) {
        console.error(`Update error on ${table}.${r.id}:`, upError.message);
      } else {
        updated++;
      }
    }
  }

  return { processed: rows.length, updated };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminCheck = await requirePlatformAdmin(req);
  if (!adminCheck.ok) {
    return new Response(JSON.stringify({ error: adminCheck.reason }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: BackfillRequest = await req.json().catch(() => ({}));
    const table = body.table || "all";
    const batchSize = Math.min(Math.max(body.batch_size ?? 100, 1), 1000);
    const dryRun = !!body.dry_run;
    const aiEnrich = !!body.ai_enrich;

    const supabaseSr = createClient(SUPABASE_URL, SERVICE_KEY);

    const targets: TargetTable[] = table === "all" ? ["candidates", "job_candidates", "jobs"] : [table];
    const results: Record<string, { processed: number; updated: number }> = {};

    for (const t of targets) {
      console.log(`Backfilling table: ${t} (batch ${batchSize}, dryRun=${dryRun}, aiEnrich=${aiEnrich})`);
      const res = await backfillTable(supabaseSr, t, batchSize, dryRun, aiEnrich);
      results[t] = res;
    }

    return new Response(JSON.stringify({
      ok: true,
      dryRun,
      aiEnrich,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("backfill-standardized-skills error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
