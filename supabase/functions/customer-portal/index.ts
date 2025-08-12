
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, details?: unknown) => console.log(`[customer-portal] ${msg}`, details ?? "");

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

    // Optional tenantId from body
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

    // Resolve or create Stripe customer
    let customerId = tenantSubRow?.stripe_customer_id || null;
    if (!customerId && user.email) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) customerId = existing.data[0].id;
    }
    if (!customerId) {
      if (!user.email) throw new Error("No email available to create a Stripe customer");
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.first_name
          ? `${user.user_metadata.first_name ?? ""} ${user.user_metadata.last_name ?? ""}`.trim()
          : undefined,
        metadata: { tenant_id: String(tenantId) },
      });
      customerId = customer.id;
    }

    // Persist stripe_customer_id if missing
    if (!tenantSubRow?.stripe_customer_id && customerId) {
      const { error: updErr } = await supabase
        .from("tenant_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("tenant_id", tenantId);
      if (updErr) throw new Error(`Failed to update stripe_customer_id: ${updErr.message}`);
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?billing=success`,
    });
    log("Portal session created", { id: session.id, tenantId });
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[customer-portal] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
