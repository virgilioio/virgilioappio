// Gio Sign: what a sender (or admin) does to an envelope that's out, when it
// needs email. Signed-in users only (JWT). The permission check is the
// database's: each action calls its RPC as the signed-in user, and only then
// sends email with the service role.
//   remind { envelope_id }          -> fresh links to whoever's turn it is
//   void   { envelope_id, reason }  -> every link stops; people are told
// ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { adminClient, json } from "../_shared/sign/signer.ts";
import { notifyVoided, remindRecipient } from "../_shared/sign/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method" }, corsHeaders);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized" }, corsHeaders);
  const asUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const supabase = adminClient();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request" }, corsHeaders);
  }
  const envelopeId = String(body?.envelope_id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(envelopeId)) return json(400, { error: "bad_request" }, corsHeaders);

  const refused = (error: any) =>
    json(error?.code && /^GSN\d\d$/.test(error.code) ? 409 : 403, { error: error?.code ?? "refused", message: error?.message ?? null }, corsHeaders);

  try {
    if (body?.action === "remind") {
      const { data, error } = await asUser.rpc("sign_remind_request", { _envelope_id: envelopeId });
      if (error) return refused(error);
      let sent = 0;
      for (const row of (data ?? []) as { recipient_id: string }[]) {
        try {
          if (await remindRecipient(supabase, row.recipient_id)) sent++;
        } catch (err) {
          console.error("sign-manage remind", row.recipient_id, err instanceof Error ? err.message : err);
        }
      }
      return json(200, { reminded: sent }, corsHeaders);
    }
    if (body?.action === "void") {
      const { data, error } = await asUser.rpc("sign_void", { _envelope_id: envelopeId, _reason: String(body?.reason ?? "") });
      if (error) return refused(error);
      const ids = ((data ?? []) as { recipient_id: string }[]).map((r) => r.recipient_id);
      await notifyVoided(supabase, envelopeId, ids);
      return json(200, { told: ids.length }, corsHeaders);
    }
    return json(400, { error: "bad_request" }, corsHeaders);
  } catch (err) {
    console.error("sign-manage", err instanceof Error ? err.message : JSON.stringify(err));
    return json(500, { error: "server" }, corsHeaders);
  }
});
