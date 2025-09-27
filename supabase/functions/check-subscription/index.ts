
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, details?: unknown) => console.log(`[check-subscription] ${msg}`, details ?? "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) throw new Error(`Auth error: ${userErr?.message}`);
    const user = userData.user;

    // Optional tenantId from client
    const body = await req.json().catch(() => ({}));
    const explicitTenantId = body?.tenantId as string | undefined;

    // Determine tenant id: explicit -> RPC -> Virgilio -> first tenant
    let tenantId: string | null = explicitTenantId ?? null;
    if (!tenantId) {
      const { data: rpcTenantId, error: tenantErr } = await supabase.rpc("get_user_tenant_id");
      if (tenantErr) log("get_user_tenant_id error (continuing to fallback)", tenantErr);
      tenantId = (rpcTenantId as string | null) ?? null;
    }
    if (!tenantId) {
      const { data: vir, error: virErr } = await supabase
        .from("organizations")
        .select("id,name,org_kind")
        .ilike("name", "virgilio")
        .maybeSingle();
      if (virErr) log("Virgilio lookup error", virErr);
      if (vir?.id) {
        tenantId = vir.id;
        log("Falling back to tenant by name 'Virgilio'", { tenantId });
      } else {
        const { data: anyTenant, error: anyErr } = await supabase
          .from("organizations")
          .select("id,name,org_kind")
          .eq("org_kind", "tenant")
          .limit(1)
          .maybeSingle();
        if (anyErr) log("Fallback tenant lookup error", anyErr);
        if (anyTenant?.id) {
          tenantId = anyTenant.id;
          log("Falling back to first available tenant", { tenantId });
        }
      }
    }
    if (!tenantId) throw new Error("No tenant_id resolved; ensure a tenant organization exists");

    // Ensure tenant_subscriptions row exists
    const { data: tenantSubRow, error: subErr } = await supabase
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (subErr) throw new Error(`Failed loading tenant_subscriptions: ${subErr.message}`);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get or resolve customer id
    let customerId = tenantSubRow?.stripe_customer_id || null;
    if (!customerId && user.email) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) customerId = existing.data[0].id;
    }

    if (!customerId) {
      // No Stripe customer – honor active DB trial if present
      const now = new Date();
      const dbTrialActive = tenantSubRow?.trial_end ? new Date(tenantSubRow.trial_end as string) > now : false;
      const effectiveSubscribed = dbTrialActive;
      const effectiveTier = dbTrialActive ? "Trial" : null;
      const effectiveInterval = null;
      const effectiveTrialEnd = tenantSubRow?.trial_end ?? null;
      const effectiveSubEnd = dbTrialActive ? (tenantSubRow?.trial_end as string) : null;
      const seatQty = (tenantSubRow as any)?.seat_quantity ?? null;

      // Update per-user subscribers table
      await supabase.from("subscribers").upsert(
        {
          email: user.email,
          user_id: user.id,
          stripe_customer_id: null,
          subscribed: effectiveSubscribed,
          subscription_tier: effectiveTier,
          subscription_end: effectiveSubEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

      // Update tenant_subscriptions but DO NOT clear trial_end
      await supabase
        .from("tenant_subscriptions")
        .update({
          subscribed: effectiveSubscribed,
          subscription_tier: effectiveTier,
          billing_interval: effectiveInterval,
          trial_end: effectiveTrialEnd,
          subscription_end: effectiveSubEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      log("No Stripe customer – using DB trial status", { tenantId, dbTrialActive, trial_end: effectiveTrialEnd });

      return new Response(
        JSON.stringify({
          subscribed: effectiveSubscribed,
          subscription_tier: effectiveTier,
          billing_interval: effectiveInterval,
          trial_end: effectiveTrialEnd,
          subscription_end: effectiveSubEnd,
          seat_quantity: seatQty,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else if (!tenantSubRow?.stripe_customer_id) {
      // Persist discovered customer id if not stored yet
      const { error: updErr } = await supabase
        .from("tenant_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("tenant_id", tenantId);
      if (updErr) log("Failed to persist stripe_customer_id (continuing)", updErr);
    }

    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 3 });
    const activeOrTrialing = subs.data.find((s: any) => ["active", "trialing"].includes(s.status));
    const hasActive = Boolean(activeOrTrialing);
    let tier: string | null = null;
    let interval: string | null = null;
    let subEnd: string | null = null;
    let trialEnd: string | null = null;
    let quantity: number | null = null;

    if (activeOrTrialing) {
      const item = activeOrTrialing.items.data[0];
      quantity = item?.quantity ?? null;
      const price = item?.price;
      interval = (price?.recurring?.interval as "month" | "year") ?? null;
      const amount = price?.unit_amount ?? 0;
      tier = amount <= 999 ? "Basic" : amount <= 1999 ? "Premium" : "Enterprise";
      if (activeOrTrialing.current_period_end) {
        subEnd = new Date(activeOrTrialing.current_period_end * 1000).toISOString();
      }
      if (activeOrTrialing.trial_end) {
        trialEnd = new Date(activeOrTrialing.trial_end * 1000).toISOString();
      }
    }

    // Determine effective subscription taking DB trial into account if no active Stripe sub
    const dbTrialActive = tenantSubRow?.trial_end ? new Date(tenantSubRow.trial_end as string) > new Date() : false;
    let effectiveSubscribed = hasActive || dbTrialActive;
    let effectiveTier = hasActive ? tier : dbTrialActive ? "Trial" : null;
    let effectiveInterval = hasActive ? interval : null;
    let effectiveTrialEnd = hasActive ? trialEnd : tenantSubRow?.trial_end ?? null;
    let effectiveSubEnd = hasActive ? subEnd : dbTrialActive ? (tenantSubRow?.trial_end as string) : null;

    // Update tenant_subscriptions
    await supabase
      .from("tenant_subscriptions")
      .update({
        subscribed: effectiveSubscribed,
        subscription_tier: effectiveTier,
        billing_interval: effectiveInterval,
        trial_end: effectiveTrialEnd,
        subscription_end: effectiveSubEnd,
        seat_quantity: quantity ?? undefined,
        updated_at: new Date().toISOString(),
        stripe_customer_id: customerId,
      })
      .eq("tenant_id", tenantId);

    // Update per-user subscribers
    await supabase.from("subscribers").upsert(
      {
        email: user.email,
        user_id: user.id,
        stripe_customer_id: customerId,
        subscribed: effectiveSubscribed,
        subscription_tier: effectiveTier,
        subscription_end: effectiveSubEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    log("Sync complete", { hasActive: effectiveSubscribed, tier: effectiveTier, interval: effectiveInterval, trialEnd: effectiveTrialEnd, subEnd: effectiveSubEnd, quantity, tenantId });

    return new Response(
      JSON.stringify({
        subscribed: effectiveSubscribed,
        subscription_tier: effectiveTier,
        billing_interval: effectiveInterval,
        trial_end: effectiveTrialEnd,
        subscription_end: effectiveSubEnd,
        seat_quantity: quantity,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[check-subscription] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
