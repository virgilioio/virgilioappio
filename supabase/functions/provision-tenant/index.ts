import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

const log = (msg: string, details?: unknown) => console.log(`[provision-tenant] ${msg}`, details ?? "");

interface ProvisionBody {
  workspaceName: string;
  trialDays?: number;
}

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

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

  // Email verification gate - prevent tenant creation for unverified emails
  const isGoogleOAuth = user.app_metadata?.provider === 'google';
  const isEmailVerified = isGoogleOAuth 
    ? user.user_metadata?.email_verified === true
    : user.email_confirmed_at !== null;

  if (!isEmailVerified) {
    log("Email not verified", { userId: user.id, provider: user.app_metadata?.provider });
    return new Response(
      JSON.stringify({ 
        code: 'EMAIL_NOT_VERIFIED', 
        message: 'Email verification required before creating workspace' 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
    );
  }

    // Extract email domain and check for auto-join
    const emailDomain = user.email?.split('@')[1]?.toLowerCase();
    log("Email domain extracted", { emailDomain });

    // Check if domain is public (skip auto-join for gmail, yahoo, etc.)
    const { data: isPublicDomain } = await supabase
      .rpc('is_public_email_domain', { domain: emailDomain });

    if (!isPublicDomain && emailDomain) {
      // Check for verified tenant domain
      const { data: existingTenantId } = await supabase
        .rpc('get_tenant_for_verified_domain', { p_domain: emailDomain });

      if (existingTenantId) {
        log("Domain matched verified tenant, auto-joining", { 
          domain: emailDomain, 
          tenantId: existingTenantId 
        });

        // Check if user already has membership in this tenant
        const { data: existingMember } = await supabase
          .from("members")
          .select("id, organization_id, user_status")
          .eq("user_id", user.id)
          .eq("organization_id", existingTenantId)
          .maybeSingle();

        if (existingMember) {
          log("User already has membership in auto-join tenant", { 
            userId: user.id, 
            orgId: existingTenantId 
          });
          return new Response(
            JSON.stringify({
              status: "auto_joined",
              tenantId: existingTenantId,
              message: `Already a member of workspace for ${emailDomain}`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        // Add user as regular member (not workspace_owner)
        const { error: memberErr } = await supabase.from("members").insert({
          user_id: user.id,
          organization_id: existingTenantId,  // Parent tenant
          tenant_id: existingTenantId,
          user_type: "recruiter",             // Regular user, not owner
          member_role: "member",
          user_status: "active",
        });

        if (memberErr) throw new Error(`Failed to auto-join tenant: ${memberErr.message}`);

        log("Auto-join complete", { 
          userId: user.id, 
          tenantId: existingTenantId,
          domain: emailDomain 
        });

        return new Response(
          JSON.stringify({
            status: "auto_joined",
            tenantId: existingTenantId,
            message: `Joined existing workspace for ${emailDomain}`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // If no verified domain found, continue with new tenant creation...
    log("No verified domain, creating new tenant", { emailDomain });

    const body = (await req.json().catch(() => ({}))) as ProvisionBody;
    const workspaceName = (body.workspaceName || "").trim();
    const trialDays = 14; // Fixed 14-day trial
    if (!workspaceName) throw new Error("workspaceName is required");

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

    // Create tenant organization with signup tracking
    const authProvider = user.app_metadata?.provider || 'email';
    const { data: tenantOrg, error: tenantErr } = await supabase
      .from("organizations")
      .insert({ 
        name: workspaceName, 
        org_kind: "tenant", 
        status: "active", 
        owner_id: user.id,
        signup_source: "self_serve",
        tenant_type: "saas",
        organization_type: "client"
      })
      .select("id")
      .single();
    if (tenantErr) throw new Error(`Failed to create tenant org: ${tenantErr.message}`);
    const tenantId = tenantOrg.id as string;
    log("Created tenant", { tenantId });

    // Add user as workspace_owner/admin of parent tenant
    const { error: memberErr } = await supabase.from("members").insert({
      user_id: user.id,
      organization_id: tenantId,
      tenant_id: tenantId,
      user_type: "workspace_owner",
      member_role: "admin",
      user_status: "active",
    });
    if (memberErr) throw new Error(`Failed to add member: ${memberErr.message}`);

    // Start 14-day trial with new billing_status fields
    const trialStart = new Date();
    const trialEnd = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const { error: upsertErr } = await supabase.from("tenant_subscriptions").upsert(
      {
        tenant_id: tenantId,
        subscribed: false,
        subscription_tier: null,
        billing_interval: null,
        seat_quantity: 1,
        billing_status: 'trialing',
        trial_started_at: trialStart.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        trial_source: 'self_signup',
        trial_end: trialEnd.toISOString(), // Keep for backward compat
        subscription_end: null,
        last_seat_count: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );
    if (upsertErr) throw new Error(`Failed to set trial: ${upsertErr.message}`);

    log("Provisioning complete", { 
      tenantId, 
      trialEndsAt: trialEnd.toISOString(),
      trialDays: 14,
      billingStatus: 'trialing',
      authProvider, 
      signupSource: "self_serve" 
    });

    return new Response(
      JSON.stringify({ status: "ok", tenantId, trialEnd }),
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
