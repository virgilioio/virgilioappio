import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[sync-calendar-timezone] ${msg}`, data ?? "");

interface SyncRequest {
  calendar_identity_id?: string;
  user_id?: string;
}

async function getValidAccessToken(supabase: any, identity: any): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(identity.token_expires_at);
  if (expiresAt > now && identity.access_token) return identity.access_token;

  const { data: decrypted, error: dErr } = await supabase.rpc("decrypt_refresh_token", {
    encrypted_token: identity.encrypted_refresh_token,
  });
  if (dErr || !decrypted) {
    log("Failed to decrypt refresh token", dErr);
    return null;
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decrypted,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    log("Token refresh failed", await resp.text());
    return null;
  }
  const data = await resp.json();
  await supabase
    .from("calendar_identities")
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      sync_status: "healthy",
      sync_error_message: null,
    })
    .eq("id", identity.id);
  return data.access_token as string;
}

export async function syncTimezoneForIdentity(
  supabase: any,
  identity: any,
): Promise<{ ok: boolean; timezone?: string; error?: string }> {
  const accessToken = await getValidAccessToken(supabase, identity);
  if (!accessToken) return { ok: false, error: "no_access_token" };

  const tzResp = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/settings/timezone",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!tzResp.ok) {
    const body = await tzResp.text();
    log("Google timezone fetch failed", { status: tzResp.status, body });
    return { ok: false, error: `google_${tzResp.status}` };
  }
  const tzData = await tzResp.json();
  const timezone: string | undefined = tzData?.value;
  if (!timezone) return { ok: false, error: "empty_timezone" };

  // Update profile timezone only if currently UTC/null (preserve user choices)
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", identity.user_id)
    .maybeSingle();
  if (!profile?.timezone || profile.timezone === "UTC") {
    await supabase
      .from("profiles")
      .update({ timezone })
      .eq("user_id", identity.user_id);
  }

  // Update booking_configurations timezone where currently UTC/null
  const { data: updated, error: bcErr } = await supabase
    .from("booking_configurations")
    .update({ timezone })
    .eq("user_id", identity.user_id)
    .or("timezone.is.null,timezone.eq.UTC")
    .select("id");
  if (bcErr) log("booking_configurations update error", bcErr);

  log("Synced timezone", {
    user_id: identity.user_id,
    timezone,
    booking_configs_updated: updated?.length ?? 0,
  });

  return { ok: true, timezone };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");

    let body: SyncRequest = {};
    try { body = await req.json(); } catch { /* allow empty */ }

    let userId: string | undefined = body.user_id;
    if (token !== serviceKey) {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) throw new Error("Unauthorized");
      userId = user.id;
    }

    let identity;
    if (body.calendar_identity_id) {
      const { data, error } = await supabase
        .from("calendar_identities")
        .select("*")
        .eq("id", body.calendar_identity_id)
        .maybeSingle();
      if (error) throw error;
      identity = data;
    } else if (userId) {
      const { data, error } = await supabase
        .from("calendar_identities")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      identity = data;
    }

    if (!identity) {
      return new Response(JSON.stringify({ ok: false, error: "no_calendar_identity" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await syncTimezoneForIdentity(supabase, identity);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[sync-calendar-timezone] ERROR", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
