import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@16";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

const corsHeaders = createSecureCorsHeaders();

const log = (msg: string, details?: unknown) => {
  console.log(`[create-credit-purchase] ${msg}`, details ?? "");
};

// Credit bundle configurations
const CREDIT_BUNDLES = {
  '500': {
    credits: 500,
    amountCents: 4900, // $49
    priceEnvKey: 'STRIPE_PRICE_CREDITS_500',
  },
  '1500': {
    credits: 1500,
    amountCents: 12900, // $129
    priceEnvKey: 'STRIPE_PRICE_CREDITS_1500',
  },
  '5000': {
    credits: 5000,
    amountCents: 34900, // $349
    priceEnvKey: 'STRIPE_PRICE_CREDITS_5000',
  },
} as const;

type BundleSize = keyof typeof CREDIT_BUNDLES;

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

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const bundleSize = body?.bundleSize as string;
    const explicitTenantId = body?.tenantId as string | undefined;

    // Validate bundle size
    if (!bundleSize || !CREDIT_BUNDLES[bundleSize as BundleSize]) {
      throw new Error(`Invalid bundle size. Must be one of: ${Object.keys(CREDIT_BUNDLES).join(', ')}`);
    }

    const bundle = CREDIT_BUNDLES[bundleSize as BundleSize];

    // Resolve tenant id
    let tenantId: string | null = explicitTenantId ?? null;
    if (!tenantId) {
      const { data: rpcTenantId, error: tenantErr } = await supabase.rpc("get_tenant_id_for_user", {
        p_user_id: user.id
      });
      if (tenantErr) {
        log("get_tenant_id_for_user error", tenantErr);
        throw new Error(`Failed to determine tenant for user: ${tenantErr.message}`);
      }
      tenantId = (rpcTenantId as string | null) ?? null;
    }
    if (!tenantId) {
      throw new Error("Could not determine tenant for user.");
    }
    log("Resolved tenant", { tenantId, userId: user.id });

    // Verify user has an active subscription (required to purchase bundles)
    const { data: subRow, error: subErr } = await supabase
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subErr) throw new Error(`Failed loading tenant_subscriptions: ${subErr.message}`);
    
    if (!subRow || !subRow.subscribed) {
      throw new Error("An active subscription is required to purchase credit bundles.");
    }

    // Setup Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get or create customer
    let customerId = subRow.stripe_customer_id || null;
    if (!customerId && user.email) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) customerId = existing.data[0].id;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { tenant_id: String(tenantId) },
      });
      customerId = customer.id;

      // Persist customer id
      await supabase
        .from("tenant_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("tenant_id", tenantId);
    }

    // Get price ID from environment
    const priceId = Deno.env.get(bundle.priceEnvKey);
    
    const origin = req.headers.get("origin") || "http://localhost:5173";
    const success_url = `${origin}/billing?credit_purchase=success&credits=${bundle.credits}`;
    const cancel_url = `${origin}/billing?credit_purchase=canceled`;

    // Create one-time payment checkout session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      customer: customerId,
      line_items: priceId 
        ? [{ price: priceId, quantity: 1 }]
        : [{
            price_data: {
              currency: 'usd',
              unit_amount: bundle.amountCents,
              product_data: {
                name: `${bundle.credits} Credit Bundle`,
                description: `One-time purchase of ${bundle.credits} sourcing credits for GoGio ATS`,
              },
            },
            quantity: 1,
          }],
      metadata: {
        tenant_id: String(tenantId),
        type: 'credit_bundle',
        credits: String(bundle.credits),
      },
      success_url,
      cancel_url,
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    log("Credit purchase session created", { 
      id: session.id, 
      url: session.url, 
      bundleSize,
      credits: bundle.credits,
      tenantId
    });

    return new Response(JSON.stringify({ 
      url: session.url,
      credits: bundle.credits,
      amount: bundle.amountCents / 100,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[create-credit-purchase] ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
