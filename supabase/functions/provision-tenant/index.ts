import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, details?: unknown) => console.log(`[provision-tenant] ${msg}`, details ?? "");

interface ProvisionBody {
  companyName: string;
  countryCode?: string;
  workspaceName?: string;
  trialDays?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env vars");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) throw new Error(`Auth error: ${userErr?.message}`);
    const user = userData.user;

    const body = (await req.json().catch(() => ({}))) as ProvisionBody;
    const companyName = (body.companyName || "").trim();
    const workspaceName = (body.workspaceName || companyName).trim();
    const trialDays = typeof body.trialDays === "number" && body.trialDays > 0 ? body.trialDays : 30;
    if (!companyName) throw new Error("companyName is required");

    // Idempotency: if user already has an active membership, return early
    const { data: existingMember } = await supabase
      .from("members")
      .select("id, organization_id, user_status")
      .eq("user_id", user.id)
      .eq("user_status", "active")
      .limit(1)
      .maybeSingle();

    if (existingMember) {
      log("User already has active membership", { userId: user.id, orgId: existingMember.organization_id });
      return new Response(
        JSON.stringify({
          status: "exists",
          organizationId: existingMember.organization_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create tenant organization
    const { data: tenantOrg, error: tenantErr } = await supabase
      .from("organizations")
      .insert({ name: companyName, org_kind: "tenant", status: "active" })
      .select("id")
      .single();
    if (tenantErr) throw new Error(`Failed to create tenant org: ${tenantErr.message}`);
    const tenantId = tenantOrg.id as string;
    log("Created tenant", { tenantId });

    // Create first workspace under tenant
    const { data: wsOrg, error: wsErr } = await supabase
      .from("organizations")
      .insert({ name: workspaceName, org_kind: "client", parent_organization_id: tenantId, status: "active" })
      .select("id")
      .single();
    if (wsErr) throw new Error(`Failed to create workspace org: ${wsErr.message}`);
    const workspaceId = wsOrg.id as string;
    log("Created workspace", { workspaceId });

    // Add user as workspace_owner/admin
    const { error: memberErr } = await supabase.from("members").insert({
      user_id: user.id,
      organization_id: workspaceId,
      user_type: "workspace_owner",
      member_role: "admin",
      user_status: "active",
    });
    if (memberErr) throw new Error(`Failed to add member: ${memberErr.message}`);

    // Start free trial (no card)
    const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const { error: upsertErr } = await supabase.from("tenant_subscriptions").upsert(
      {
        tenant_id: tenantId,
        subscribed: false,
        subscription_tier: null,
        billing_interval: null,
        seat_quantity: 1,
        trial_end: trialEnd,
        subscription_end: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );
    if (upsertErr) throw new Error(`Failed to set trial: ${upsertErr.message}`);

    log("Provisioning complete", { tenantId, workspaceId, trialEnd });

    return new Response(
      JSON.stringify({ status: "ok", tenantId, workspaceId, trialEnd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[provision-tenant] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
