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

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  log(`🚀 Function invoked [${requestId}]`, { 
    method: req.method,
    hasAuth: !!req.headers.get("Authorization"),
    timestamp: new Date().toISOString()
  });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env vars");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");
    const token = authHeader.replace("Bearer ", "");

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    log(`Auth failed [${requestId}]`, { error: userErr?.message });
    throw new Error(`Auth error: ${userErr?.message}`);
  }
  const user = userData.user;
  
  log(`👤 User authenticated [${requestId}]`, { 
    userId: user.id, 
    email: user.email,
    provider: user.app_metadata?.provider 
  });

  // Email verification gate - prevent tenant creation for unverified emails
  const isGoogleOAuth = user.app_metadata?.provider === 'google';
  const isEmailVerified = isGoogleOAuth 
    ? user.user_metadata?.email_verified === true
    : user.email_confirmed_at !== null;

  if (!isEmailVerified) {
    log(`Email not verified [${requestId}]`, { 
      userId: user.id, 
      email: user.email,
      provider: user.app_metadata?.provider,
      emailConfirmedAt: user.email_confirmed_at,
      googleEmailVerified: user.user_metadata?.email_verified
    });
    return new Response(
      JSON.stringify({ 
        code: 'EMAIL_NOT_VERIFIED', 
        message: 'Email verification required before creating workspace' 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
    );
  }

    // Check if user already has an active membership (idempotency check)
    log(`Checking for existing membership [${requestId}]`, { userId: user.id });
    
    const { data: existingMember } = await supabase
      .from('members')
      .select('tenant_id, organization_id, user_status')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .maybeSingle();
    
    if (existingMember) {
      log(`User already provisioned [${requestId}]`, { 
        userId: user.id,
        tenantId: existingMember.tenant_id 
      });
      
      return new Response(
        JSON.stringify({ 
          status: "ok", 
          workspaceId: existingMember.tenant_id,
          tenantId: existingMember.tenant_id,
          message: "User already has an active workspace"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Extract email domain and check for auto-join
    const emailDomain = user.email?.split('@')[1]?.toLowerCase();
    log(`Email domain extracted [${requestId}]`, { 
      emailDomain, 
      userEmail: user.email 
    });

    // Check if domain is public (skip auto-join for gmail, yahoo, etc.)
    const { data: isPublicDomain } = await supabase
      .rpc('is_public_email_domain', { domain: emailDomain });
    
    log(`Domain check [${requestId}]`, { 
      emailDomain, 
      isPublicDomain 
    });

    if (!isPublicDomain && emailDomain) {
      // Check for verified tenant domain
      const { data: existingTenantId } = await supabase
        .rpc('get_tenant_for_verified_domain', { p_domain: emailDomain });

      if (existingTenantId) {
        log(`Domain matched verified tenant, auto-joining [${requestId}]`, { 
          domain: emailDomain, 
          tenantId: existingTenantId,
          userId: user.id
        });

        // Check if user already has membership in this tenant
        const { data: existingMember } = await supabase
          .from("members")
          .select("id, tenant_id, user_status")
          .eq("user_id", user.id)
          .eq("tenant_id", existingTenantId)
          .maybeSingle();

        if (existingMember) {
          log(`User already has membership in auto-join tenant [${requestId}]`, { 
            userId: user.id, 
            orgId: existingTenantId,
            memberStatus: existingMember.user_status
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
          user_type: "member",                // Valid user_type_enum value
          member_role: "recruiter",           // Valid member_role enum value
          user_status: "active",
        });

        if (memberErr) {
          log(`Auto-join failed [${requestId}]`, { 
            error: memberErr.message,
            userId: user.id,
            tenantId: existingTenantId
          });
          throw new Error(`Failed to auto-join tenant: ${memberErr.message}`);
        }

        log(`Auto-join complete [${requestId}]`, { 
          userId: user.id, 
          tenantId: existingTenantId,
          domain: emailDomain,
          duration: Date.now() - startTime
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
    log(`No verified domain, creating new tenant [${requestId}]`, { 
      emailDomain,
      userId: user.id 
    });

    const body = (await req.json().catch(() => ({}))) as ProvisionBody;
    const workspaceName = (body.workspaceName || "").trim();
    const trialDays = 14; // Fixed 14-day trial
    
    log(`Workspace name received [${requestId}]`, { 
      workspaceName, 
      userId: user.id 
    });
    
    if (!workspaceName) {
      log(`Missing workspace name [${requestId}]`, { userId: user.id });
      throw new Error("workspaceName is required");
    }

    // Create tenant organization with signup tracking
    const authProvider = user.app_metadata?.provider || 'email';
    
    log(`Creating tenant organization [${requestId}]`, { 
      workspaceName, 
      userId: user.id,
      authProvider 
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
        owner_id: user.id,
        signup_source: "self_serve"
      });

    if (tenantErr) {
      log(`Failed to create tenant [${requestId}]`, { 
        error: tenantErr.message,
        code: tenantErr.code,
        details: tenantErr.details,
        hint: tenantErr.hint,
        userId: user.id,
        workspaceName 
      });
      throw new Error(`Failed to create tenant: ${tenantErr.message}`);
    }
    
    log(`✅ Created tenant [${requestId}]`, { 
      tenantId,
      userId: user.id,
      workspaceName 
    });

    // 2. Create matching root organization (satisfies members.organization_id FK)
    log(`Attempting to create root organization [${requestId}]`, {
      tenantId,
      workspaceName,
      userId: user.id,
      auth_context: 'service_role',
      timestamp: new Date().toISOString()
    });

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
      // Enhanced logging for debugging
      log(`❌ CRITICAL: Failed to create root organization [${requestId}]`, { 
        error: orgErr.message,
        code: orgErr.code,
        details: orgErr.details,
        hint: orgErr.hint,
        tenantId,
        userId: user.id,
        auth_context: 'service_role',
        timestamp: new Date().toISOString()
      });
      
      // CRITICAL: Also log to console.error for edge function logs
      console.error(`[provision-tenant] ORG_CREATE_FAILED [${requestId}]`, {
        error: orgErr.message,
        code: orgErr.code,
        details: orgErr.details,
        hint: orgErr.hint,
        tenantId,
        userId: user.id,
        workspaceName
      });
      
      throw new Error(`Failed to create root org: ${orgErr.message}`);
    }

    log(`✅ Created root organization [${requestId}]`, { 
      tenantId,
      userId: user.id 
    });

    // 3. Create first member using SECURITY DEFINER function (bypasses RLS)
    log(`👤 Creating first member via RPC [${requestId}]`, { 
      userId: user.id,
      tenantId 
    });
    
    const { data: memberId, error: memberErr } = await supabase
      .rpc('admin_insert_first_member', {
        p_tenant_id: tenantId,
        p_user_id: user.id
      });
    
    if (memberErr) {
      log(`❌ Failed to create member via RPC [${requestId}]`, { 
        error: memberErr.message,
        code: memberErr.code,
        details: memberErr.details,
        hint: memberErr.hint,
        userId: user.id,
        tenantId
      });
      throw new Error(`Failed to add member: ${memberErr.message}`);
    }
    
    log(`✅ First member created [${requestId}]`, { 
      memberId,
      userId: user.id,
      tenantId 
    });

    // 4. Create pending_trial subscription (requires CC to start actual trial)
    // GoGio ATS uses a credit card wall - trial doesn't start until checkout is completed
    
    // Check if subscription record already exists
    const { data: existingTrial } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    
    if (existingTrial) {
      log(`⏭️ Subscription record already exists, skipping [${requestId}]`, { tenantId });
    } else {
      log(`🎁 Creating pending_trial subscription (CC required) [${requestId}]`, { 
        tenantId,
        note: 'User must add payment method to start 14-day trial'
      });
      
      const { error: upsertErr } = await supabase.from("tenant_subscriptions").insert({
        tenant_id: tenantId,
        subscribed: false,
        subscription_tier: null,
        billing_interval: null,
        seat_quantity: 1,
        billing_status: 'pending_trial', // NEW: Requires CC to start trial
        trial_started_at: null, // Trial hasn't started yet
        trial_ends_at: null,
        trial_source: 'self_signup_cc_required',
        trial_end: null,
        subscription_end: null,
        last_seat_count: 1,
        bonus_credits_purchased: 0,
        bonus_credits_used: 0,
        updated_at: new Date().toISOString(),
      });
      
      if (upsertErr) {
        log(`❌ Failed to create pending_trial subscription [${requestId}]`, { 
          error: upsertErr.message,
          code: upsertErr.code,
          details: upsertErr.details,
          hint: upsertErr.hint,
          tenantId
        });
        throw new Error(`Failed to set pending_trial: ${upsertErr.message}`);
      }
      
      log(`✅ Pending trial subscription created (awaiting CC) [${requestId}]`, { tenantId });
    }

    log(`🎉 Provisioning complete [${requestId}]`, { 
      tenantId, 
      userId: user.id,
      email: user.email,
      workspaceName,
      trialEndsAt: trialEnd.toISOString(),
      trialDays: 14,
      billingStatus: 'trialing',
      authProvider, 
      signupSource: "self_serve",
      duration: `${Date.now() - startTime}ms`
    });

    return new Response(
      JSON.stringify({ 
        status: "ok", 
        workspaceId: tenantId,  // Frontend expects this field name
        tenantId,               // Keep for backward compatibility
        trialEnd 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    
    log(`❌ ERROR [${requestId}]`, { 
      error: message,
      stack,
      duration: `${Date.now() - startTime}ms`
    });
    
    console.error(`[provision-tenant] ❌ ERROR [${requestId}]`, {
      message,
      stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ 
      error: message,
      requestId,
      duration: `${Date.now() - startTime}ms`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
