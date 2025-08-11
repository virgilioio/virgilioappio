
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, details?: unknown) => {
  console.log(`[create-checkout] ${msg}`, details ?? "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Determine tenant id
    const { data: tenantId, error: tenantErr } = await supabase.rpc("get_user_tenant_id");
    if (tenantErr) throw new Error(`Failed to get tenant id: ${tenantErr.message}`);
    if (!tenantId) throw new Error("No tenant_id for current user");

    // Load / ensure tenant subscription row
    const { data: tenantSubRow, error: subErr } = await supabase
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();
    if (subErr) throw new Error(`Failed loading tenant_subscriptions: ${subErr.message}`);

    // Compute current billable seats
    const { data: seatCount, error: seatErr } = await supabase.rpc("get_tenant_billable_seat_count", {
      tenant_id_param: tenantId,
    });
    if (seatErr) throw new Error(`Failed computing seat count: ${seatErr.message}`);
    const quantity = Math.max(1, Number(seatCount ?? 0)); // Stripe requires >= 1
    log("Seat quantity", { quantity });

    // Setup Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Find or create customer
    let customerId = tenantSubRow?.stripe_customer_id || null;
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
    if (!tenantSubRow?.stripe_customer_id && customerId) {
      const { error: updErr } = await supabase
        .from("tenant_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("tenant_id", tenantId);
      if (updErr) throw new Error(`Failed to update stripe_customer_id: ${updErr.message}`);
    }

    // Read requested interval from client (month | year), default month
    const body = await req.json().catch(() => ({}));
    const interval = body?.interval === "year" ? "year" : "month";
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

    log("Session created", { id: session.id, url: session.url, interval, quantity });

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
