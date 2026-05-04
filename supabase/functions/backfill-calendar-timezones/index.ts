import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[backfill-calendar-timezones] ${msg}`, data ?? "");

async function getValidAccessToken(supabase: any, identity: any): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(identity.token_expires_at);
  if (expiresAt > now && identity.access_token) return identity.access_token;

  const { data: decrypted } = await supabase.rpc("decrypt_refresh_token", {
    encrypted_token: identity.encrypted_refresh_token,
  });
  if (!decrypted) return null;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: decrypted,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  await supabase
    .from("calendar_identities")
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    })
    .eq("id", identity.id);
  return data.access_token as string;
}

async function syncOne(supabase: any, identity: any) {
  const accessToken = await getValidAccessToken(supabase, identity);
  if (!accessToken) return { user_id: identity.user_id, ok: false, error: "no_access_token" };

  const tzResp = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/settings/timezone",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!tzResp.ok) {
    return { user_id: identity.user_id, ok: false, error: `google_${tzResp.status}` };
  }
  const { value: timezone } = await tzResp.json();
  if (!timezone) return { user_id: identity.user_id, ok: false, error: "empty_timezone" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", identity.user_id)
    .maybeSingle();
  if (!profile?.timezone || profile.timezone === "UTC") {
    await supabase.from("profiles").update({ timezone }).eq("user_id", identity.user_id);
  }

  const { data: updated } = await supabase
    .from("booking_configurations")
    .update({ timezone })
    .eq("user_id", identity.user_id)
    .or("timezone.is.null,timezone.eq.UTC")
    .select("id");

  return {
    user_id: identity.user_id,
    email: identity.email_address,
    ok: true,
    timezone,
    booking_configs_updated: updated?.length ?? 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Allow service-role OR an authenticated platform admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (token !== serviceKey) {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Platform admin required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: identities, error } = await supabase
      .from("calendar_identities")
      .select("*")
      .eq("is_active", true);
    if (error) throw error;

    log(`Found ${identities?.length ?? 0} active calendar identities`);

    const results: any[] = [];
    for (const identity of identities ?? []) {
      try {
        results.push(await syncOne(supabase, identity));
      } catch (e) {
        results.push({
          user_id: identity.user_id,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const summary = {
      total: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    };
    log("Backfill complete", summary);

    return new Response(JSON.stringify({ summary, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[backfill-calendar-timezones] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
