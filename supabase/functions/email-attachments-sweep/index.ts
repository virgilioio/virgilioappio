// Clears email attachment files whose email no longer exists (2026-10-12).
// Internal only (x-internal-secret). Body: {} runs up to `max_batches`
// batches of 500; {"dry_run": true} only counts the first batch.
// The list comes from email_attachment_orphans() (files over a day old with
// no email row and no reference), removed through the Storage API.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/referenceTokens.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || req.headers.get("x-internal-secret") !== expected) return json(401, { error: "unauthorized" });

  const sb = adminClient();
  const body = await req.json().catch(() => ({})) as { dry_run?: boolean; max_batches?: number };
  const maxBatches = Math.min(Math.max(1, Number(body.max_batches ?? 30)), 60);
  const out = { removed: 0, bytes: 0, batches: 0, errors: [] as string[] };

  for (let i = 0; i < maxBatches; i++) {
    const { data, error } = await sb.rpc("email_attachment_orphans", { p_limit: 500 });
    if (error) return json(500, { ...out, error: error.message });
    const rows = (data ?? []) as { name: string; size: number | null }[];
    if (body.dry_run) return json(200, { dry_run: true, first_batch: rows.length, bytes: rows.reduce((s, r) => s + (r.size ?? 0), 0) });
    if (!rows.length) break;
    for (let j = 0; j < rows.length; j += 100) {
      const chunk = rows.slice(j, j + 100);
      const { error: rmErr } = await sb.storage.from("email-attachments").remove(chunk.map((r) => r.name));
      if (rmErr) {
        out.errors.push(rmErr.message.slice(0, 200));
        return json(500, out);
      }
      out.removed += chunk.length;
      out.bytes += chunk.reduce((s, r) => s + (r.size ?? 0), 0);
    }
    out.batches++;
  }
  return json(200, out);
});
