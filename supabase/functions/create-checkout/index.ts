
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

const log = (msg: string, details?: unknown) => {
  console.log(`[create-checkout] ${msg}`, details ?? "");
};

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) throw new Error(`Auth error: ${userErr?.message}`);
    const user = userData.user;
    log("User", { id: user.id, email: user.email });

    // Read requested interval and optional tenantId from client
    const body = await req.json().catch(() => ({}));
    const interval = body?.interval === "year" ? "year" : "month";
    const explicitTenantId = body?.tenantId as string | undefined;

    // Resolve tenant id: prefer explicit, else RPC, else fallback to Virgilio or first tenant
    let tenantId: string | null = explicitTenantId ?? null;
    if (!tenantId) {
      const { data: rpcTenantId, error: tenantErr } = await supabase.rpc("get_user_tenant_id");
      if (tenantErr) log("get_user_tenant_id error (continuing to fallback)", tenantErr);
      tenantId = (rpcTenantId as string | null) ?? null;
    }
    if (!tenantId) {
      // Try exact (case-insensitive) match to "Virgilio"
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
        // Fallback to first tenant org_kind='tenant'
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

    if (!tenantSubRow) {
      const trialStart = new Date();
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      
      const { error: insertSubErr } = await supabase
        .from("tenant_subscriptions")
        .insert({ 
          tenant_id: tenantId, 
          subscribed: false, 
          seat_quantity: 0,
          billing_status: 'trialing',
          trial_started_at: trialStart.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
          trial_source: 'checkout_fallback'
        });
      if (insertSubErr) throw new Error(`Failed creating tenant_subscriptions row: ${insertSubErr.message}`);
      log("Created tenant_subscriptions row with trial", { tenantId, trialEndsAt: trialEnd.toISOString() });
    }

    // Compute current billable seats
    const { data: seatCount, error: seatErr } = await supabase.rpc("get_tenant_billable_seat_count", {
      tenant_id_param: tenantId,
    });
    if (seatErr) throw new Error(`Failed computing seat count: ${seatErr.message}`);
    const quantity = Math.max(1, Number(seatCount ?? 0)); // Stripe requires >= 1
    log("Seat quantity", { quantity });

    // Setup Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Reload tenant_subscriptions (may have been newly inserted) to get stripe_customer_id
    const { data: subRow2, error: subErr2 } = await supabase
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (subErr2) throw new Error(`Failed reloading tenant_subscriptions: ${subErr2.message}`);

    // Find or create customer
    let customerId = subRow2?.stripe_customer_id || null;
    if (!customerId && user.email) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) customerId = existing.data[0].id;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.user_metadata?.first_name
          ? `${user.user_metadata.first_name ?? ""} ${user.user_metadata.last_name ?? ""}`.trim()
          : undefined,
        metadata: { tenant_id: String(tenantId) },
      });
      customerId = customer.id;
    }

    // Persist customer id if missing
    if (!subRow2?.stripe_customer_id && customerId) {
      const { error: updErr } = await supabase
        .from("tenant_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("tenant_id", tenantId);
      if (updErr) throw new Error(`Failed to update stripe_customer_id: ${updErr.message}`);
    }

    const unit_amount = interval === "year" ? 29900 : 2900;

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const success_url = `${origin}/?billing=success`;
    const cancel_url = `${origin}/?billing=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId || undefined,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Virgilio Pro (per active seat)" },
            unit_amount,
            recurring: { interval },
          },
          quantity,
        },
      ],
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          tenant_id: String(tenantId),
        },
      },
      success_url,
      cancel_url,
      allow_promotion_codes: true,
    });

    log("Session created", { id: session.id, url: session.url, interval, quantity, tenantId });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[create-checkout] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
