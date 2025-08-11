
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, details?: unknown) => console.log(`[update-seat-quantity] ${msg}`, details ?? "");

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

    const { data: tenantId, error: tenantErr } = await supabase.rpc("get_user_tenant_id");
    if (tenantErr) throw new Error(`Failed to get tenant id: ${tenantErr.message}`);
    if (!tenantId) throw new Error("No tenant_id for current user");

    // Compute the latest seat count
    const { data: seatCount, error: seatErr } = await supabase.rpc("get_tenant_billable_seat_count", {
      tenant_id_param: tenantId,
    });
    if (seatErr) throw new Error(`Failed computing seat count: ${seatErr.message}`);
    const quantity = Math.max(1, Number(seatCount ?? 0));
    log("Computed seat quantity", { quantity });

    const { data: tenantSubRow, error: subErr } = await supabase
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();
    if (subErr) throw new Error(`Failed loading tenant_subscription: ${subErr.message}`);

    const customerId = tenantSubRow?.stripe_customer_id;
    if (!customerId) {
      // Update only DB seat count if no customer yet (not subscribed)
      await supabase.from("tenant_subscriptions").update({ seat_quantity: quantity }).eq("tenant_id", tenantId);
      return new Response(JSON.stringify({ seat_quantity: quantity, stripeUpdated: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
    if (subs.data.length === 0) {
      // No active subscription: just update DB seat count
      await supabase.from("tenant_subscriptions").update({ seat_quantity: quantity }).eq("tenant_id", tenantId);
      return new Response(JSON.stringify({ seat_quantity: quantity, stripeUpdated: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const sub = subs.data[0];
    const item = sub.items.data[0];
    if (!item) throw new Error("No subscription item found");

    // Update Stripe quantity
    await stripe.subscriptionItems.update(item.id, { quantity });

    // Save in DB
    await supabase.from("tenant_subscriptions").update({ seat_quantity: quantity }).eq("tenant_id", tenantId);

    log("Seat quantity synced to Stripe", { quantity, subscriptionId: sub.id, itemId: item.id });

    return new Response(JSON.stringify({ seat_quantity: quantity, stripeUpdated: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[update-seat-quantity] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
