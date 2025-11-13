import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

const log = (msg: string, details?: unknown) => console.log(`[manual-provision-tenant] ${msg}`, details ?? "");

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env vars");
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, { 
      auth: { persistSession: false } 
    });

    // Verify platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) throw new Error(`Auth error: ${userErr?.message}`);
    const adminUser = userData.user;

    // Check if admin is platform admin
    const { data: adminMember } = await supabase
      .from("members")
      .select("user_type")
      .eq("user_id", adminUser.id)
      .eq("user_type", "platform_admin")
      .single();

    if (!adminMember) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Platform admin only" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const body = await req.json();
    const { userId, workspaceName } = body;

    if (!userId || !workspaceName) {
      throw new Error("userId and workspaceName are required");
    }

    log("Manual provisioning started", { 
      userId, 
      workspaceName, 
      performedBy: adminUser.id 
    });

    // Generate UUID once for both tenant and root organization
    const tenantId = crypto.randomUUID();

    // 1. Create tenant record
    const { error: tenantErr } = await supabase
      .from("tenants")
      .insert({ 
        id: tenantId,
        name: workspaceName,
        tenant_type: "saas",
        status: "active",
        owner_id: userId,
        signup_source: "admin_recovery"
      });

    if (tenantErr) {
      log("Failed to create tenant", { error: tenantErr });
      throw new Error(`Failed to create tenant: ${tenantErr.message}`);
    }

    log("Created tenant", { tenantId });

    // 2. Create matching root organization (satisfies members.organization_id FK)
    const { error: orgErr } = await supabase
      .from("organizations")
      .insert({
        id: tenantId,  // SAME UUID - critical for FK constraint
        name: workspaceName,
        org_kind: "root",
        status: "active",
        tenant_id: tenantId,
        parent_organization_id: null
      });

    if (orgErr) {
      log("Failed to create root organization", { error: orgErr });
      throw new Error(`Failed to create root org: ${orgErr.message}`);
    }

    log("Created root organization", { tenantId });

    // Add member record
    const { error: memberErr } = await supabase.from("members").insert({
      user_id: userId,
      organization_id: tenantId,
      tenant_id: tenantId,
      user_type: "workspace_owner",
      member_role: "admin",
      user_status: "active",
    });

    if (memberErr) {
      log("Failed to create member", { error: memberErr });
      throw new Error(`Failed to add member: ${memberErr.message}`);
    }

    log("Created member record", { userId, tenantId });

    // Create trial subscription
    const trialStart = new Date();
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    
    const { error: subErr } = await supabase.from("tenant_subscriptions").insert({
      tenant_id: tenantId,
      subscribed: false,
      subscription_tier: null,
      billing_interval: null,
      seat_quantity: 1,
      billing_status: 'trialing',
      trial_started_at: trialStart.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      trial_source: 'admin_recovery',
      trial_end: trialEnd.toISOString(),
      subscription_end: null,
      last_seat_count: 1,
    });

    if (subErr) {
      log("Failed to create subscription", { error: subErr });
      throw new Error(`Failed to create subscription: ${subErr.message}`);
    }

    log("Manual provisioning complete", { 
      tenantId, 
      userId, 
      trialEndsAt: trialEnd.toISOString(),
      performedBy: adminUser.id 
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        tenantId,
        message: "User provisioned successfully",
        trialEndsAt: trialEnd.toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[manual-provision-tenant] ERROR", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
