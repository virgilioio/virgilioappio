// Gio Sign: the hourly job (pg_cron at :07, x-internal-secret). Expires
// envelopes past their date and tells the sender, warns senders 3 days
// before expiry (once), and sends automatic reminders on each envelope's
// cadence. ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, json } from "../_shared/sign/signer.ts";
import { notifySenderExpiry, remindRecipient } from "../_shared/sign/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || req.headers.get("x-internal-secret") !== expected) {
    return json(401, { error: "unauthorized" }, corsHeaders);
  }
  const supabase = adminClient();
  const out = { expired: 0, warned: 0, reminded: 0, failed: 0 };
  const safe = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      out.failed++;
      console.error("sign-remind", err instanceof Error ? err.message : JSON.stringify(err));
    }
  };
  try {
    const { data: expired, error: e1 } = await supabase.rpc("sign_expire_due", { _limit: 200 });
    if (e1) throw e1;
    for (const row of (expired ?? []) as { envelope_id: string }[]) {
      out.expired++;
      await safe(() => notifySenderExpiry(supabase, row.envelope_id, true));
    }
    const { data: soon, error: e2 } = await supabase.rpc("sign_expiring_claim", { _limit: 200 });
    if (e2) throw e2;
    for (const row of (soon ?? []) as { envelope_id: string }[]) {
      out.warned++;
      await safe(() => notifySenderExpiry(supabase, row.envelope_id, false));
    }
    const { data: due, error: e3 } = await supabase.rpc("sign_reminders_due", { _limit: 200 });
    if (e3) throw e3;
    for (const row of (due ?? []) as { recipient_id: string }[]) {
      await safe(async () => {
        if (await remindRecipient(supabase, row.recipient_id)) out.reminded++;
      });
    }
    return json(200, out, corsHeaders);
  } catch (err) {
    console.error("sign-remind", err instanceof Error ? err.message : JSON.stringify(err));
    return json(500, { error: "server", ...out }, corsHeaders);
  }
});
