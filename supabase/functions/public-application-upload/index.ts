// One-time upload links for Audio, Video and File upload questions on public
// application forms. The candidate's browser puts the file straight into
// storage (big videos never pass through a function), into a staging folder
// for that posting and question; public-submit-application checks it and files
// it with the candidate when they apply.
//
// POST { posting_id, field_id, file_name, content_type, size }
//   -> { path, token, signed_url }   only for a live posting that has that
//      question, a file of the right kind and size, and within a per-IP limit.
// POST { sweep: true } with x-internal-secret (pg_cron, daily)
//   -> clears staged files nobody submitted within a day.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight, withRequestCors } from "../_shared/cors.ts";
import {
  extOf,
  isMediaKind,
  MEDIA_BUCKET,
  mediaProblem,
  STAGE_ROOT,
  STAGE_TTL_MS,
  stageDir,
  UUID_RE,
} from "../_shared/applicationMedia.ts";

const corsHeaders = createSecureCorsHeaders();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

type Admin = ReturnType<typeof createClient>;

async function sweep(supabase: Admin): Promise<number> {
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const cutoff = Date.now() - STAGE_TTL_MS;
  let removed = 0;
  const { data: postings } = await bucket.list(STAGE_ROOT, { limit: 1000 });
  for (const p of postings ?? []) {
    if (p.id) continue; // folders only
    const { data: fields } = await bucket.list(`${STAGE_ROOT}/${p.name}`, { limit: 1000 });
    for (const f of fields ?? []) {
      if (f.id) continue;
      const dir = `${STAGE_ROOT}/${p.name}/${f.name}`;
      const { data: files } = await bucket.list(dir, { limit: 1000 });
      const old = (files ?? [])
        .filter((x) => x.id && new Date(x.created_at ?? 0).getTime() < cutoff)
        .map((x) => `${dir}/${x.name}`);
      if (old.length) {
        const { error } = await bucket.remove(old);
        if (!error) removed += old.length;
      }
    }
  }
  return removed;
}

serve(withRequestCors(async (req) => {
  const preflight = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== "POST") return json(405, { error: "Use POST." });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "That request couldn't be read." });
  }

  if (body.sweep === true) {
    const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    if (!expected || req.headers.get("x-internal-secret") !== expected) return json(401, { error: "Not allowed." });
    try {
      return json(200, { ok: true, removed: await sweep(supabase) });
    } catch (e) {
      console.error("[public-application-upload] sweep failed", e);
      return json(500, { error: "Sweep failed." });
    }
  }

  const postingId = String(body.posting_id ?? "");
  const fieldId = String(body.field_id ?? "");
  const fileName = String(body.file_name ?? "").slice(0, 240);
  const contentType = String(body.content_type ?? "").slice(0, 120);
  const size = Number(body.size);
  if (!UUID_RE.test(postingId) || !UUID_RE.test(fieldId) || !fileName) {
    return json(400, { error: "That upload is missing its question." });
  }

  // 40 files an hour per address is plenty for one application with retries.
  try {
    const { data } = await supabase.rpc("chat_bump_rate_limit", {
      p_scope: "application_upload",
      p_scope_key: clientIp(req),
      p_window_seconds: 3600,
      p_max: 40,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.allowed === false) return json(429, { error: "Too many uploads from here. Try again in a little while." });
  } catch {
    /* the limiter fails open */
  }

  const { data: posting } = await supabase
    .from("job_postings")
    .select("id, is_active")
    .eq("id", postingId)
    .maybeSingle();
  if (!posting || posting.is_active === false) return json(404, { error: "This job post is no longer open." });

  const { data: field } = await supabase
    .from("job_posting_application_fields")
    .select("id, field_type")
    .eq("id", fieldId)
    .eq("posting_id", postingId)
    .maybeSingle();
  const kind = field?.field_type;
  if (!field || !isMediaKind(kind)) return json(404, { error: "That question isn't on this job post." });

  const problem = mediaProblem(kind, fileName, contentType, size);
  if (problem) return json(400, { error: problem });

  const path = `${stageDir(postingId, fieldId)}/${crypto.randomUUID()}.${extOf(fileName)}`;
  const { data: signed, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !signed) {
    console.error("[public-application-upload] couldn't sign", error);
    return json(500, { error: "The upload couldn't start. Try again." });
  }
  return json(200, { path, token: signed.token, signed_url: signed.signedUrl });
}));
