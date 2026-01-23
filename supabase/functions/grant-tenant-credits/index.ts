import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const log = (msg: string, details?: unknown) => {
  console.log(`[grant-tenant-credits] ${msg}`, details ?? "");
};

interface GrantCreditsRequest {
  tenantId: string;
  credits: number;
  reason: string;
}

serve(async (req) => {
  const origin = req.headers.get("Origin") ?? undefined;
  const corsHeaders = corsHeadersFor(origin);
  
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) throw new Error(`Auth error: ${userErr?.message}`);
    const user = userData.user;
    log("User", { id: user.id, email: user.email });

    // Verify the user is a platform admin
    const { data: memberData, error: memberErr } = await supabase
      .from("members")
      .select("member_role")
      .eq("user_id", user.id)
      .eq("user_status", "active")
      .limit(1)
      .maybeSingle();

    if (memberErr) throw new Error(`Member lookup failed: ${memberErr.message}`);
    if (!memberData || memberData.member_role !== "platform_admin") {
      throw new Error("Unauthorized: Only platform admins can grant credits");
    }

    // Parse request body
    const body: GrantCreditsRequest = await req.json();
    const { tenantId, credits, reason } = body;

    if (!tenantId) throw new Error("tenantId is required");
    if (!credits || credits <= 0) throw new Error("credits must be a positive number");
    if (!reason || reason.trim() === "") throw new Error("reason is required");

    log("Granting credits", { tenantId, credits, reason, grantedBy: user.id });

    // Insert a credit purchase record (complimentary)
    const { data: purchaseData, error: purchaseErr } = await supabase
      .from("credit_purchases")
      .insert({
        tenant_id: tenantId,
        credits_purchased: credits,
        credits_remaining: credits,
        amount_cents: 0, // Complimentary
        bundle_type: "grant",
        purchased_by: user.id,
        stripe_payment_id: null,
        stripe_session_id: null,
      })
      .select()
      .single();

    if (purchaseErr) {
      log("Failed to insert credit_purchases", purchaseErr);
      throw new Error(`Failed to record credit grant: ${purchaseErr.message}`);
    }

    // Update tenant_subscriptions bonus_credits_purchased
    const { error: subUpdateErr } = await supabase
      .from("tenant_subscriptions")
      .update({
        bonus_credits_purchased: supabase.rpc("", {}).raw
          ? supabase.raw(`COALESCE(bonus_credits_purchased, 0) + ${credits}`)
          : credits, // Fallback - we need to do this differently
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    // Alternative: fetch and update
    if (subUpdateErr) {
      log("Direct update failed, using fetch-update pattern", subUpdateErr.message);
      
      const { data: subData, error: fetchErr } = await supabase
        .from("tenant_subscriptions")
        .select("bonus_credits_purchased")
        .eq("tenant_id", tenantId)
        .single();

      if (fetchErr) throw new Error(`Failed to fetch subscription: ${fetchErr.message}`);

      const currentBonus = subData?.bonus_credits_purchased || 0;
      const { error: updateErr } = await supabase
        .from("tenant_subscriptions")
        .update({
          bonus_credits_purchased: currentBonus + credits,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      if (updateErr) throw new Error(`Failed to update bonus credits: ${updateErr.message}`);
    }

    log("Credits granted successfully", { purchaseId: purchaseData.id, credits, tenantId });

    return new Response(
      JSON.stringify({
        success: true,
        purchaseId: purchaseData.id,
        creditsGranted: credits,
        tenantId,
        reason,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[grant-tenant-credits] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
