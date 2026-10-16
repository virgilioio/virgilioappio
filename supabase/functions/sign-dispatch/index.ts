// Gio Sign: the minute job (pg_cron, x-internal-secret). Sends envelopes
// whose Undo window has passed or whose scheduled time has come, then sends
// every invitation still owed (new envelopes, next turns, failed emails).
// ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, json } from "../_shared/sign/signer.ts";
import { invitePending, logSent } from "../_shared/sign/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || req.headers.get("x-internal-secret") !== expected) {
    return json(401, { error: "unauthorized" }, corsHeaders);
  }
  const supabase = adminClient();
  try {
    const { data: due, error } = await supabase.rpc("sign_claim_due", { _limit: 50 });
    if (error) throw error;
    for (const row of (due ?? []) as { envelope_id: string }[]) {
      await logSent(supabase, row.envelope_id);
    }
    const invites = await invitePending(supabase, 100);
    return json(200, { claimed: (due ?? []).length, ...invites }, corsHeaders);
  } catch (err) {
    console.error("sign-dispatch", err instanceof Error ? err.message : JSON.stringify(err));
    return json(500, { error: "server" }, corsHeaders);
  }
});
