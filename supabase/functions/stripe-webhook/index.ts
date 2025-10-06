import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../../utils/createSecureEdgeFunction.ts";

const corsHeaders = createSecureCorsHeaders();

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    logStep("Webhook received");

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeSecretKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    // Use service role key for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    
    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type, eventId: event.id });
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err instanceof Error ? err.message : 'Unknown error' });
      return new Response(`Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { status: 400 });
    }

    // Check if we've already processed this event (idempotency)
    const { data: existingEvent } = await supabaseClient
      .from("stripe_webhook_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .single();

    if (existingEvent) {
      logStep("Event already processed, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, status: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Record the event as being processed
    await supabaseClient
      .from("stripe_webhook_events")
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
      });

    logStep("Processing event", { eventType: event.type });

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(supabaseClient, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabaseClient, event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(supabaseClient, event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(supabaseClient, event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(supabaseClient, event.data.object as Stripe.Subscription);
        break;

      default:
        logStep("Unhandled event type", { eventType: event.type });
    }

    logStep("Event processed successfully", { eventType: event.type, eventId: event.id });

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR processing webhook", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function handleSubscriptionChange(supabaseClient: any, subscription: Stripe.Subscription) {
  logStep("Handling subscription change", { subscriptionId: subscription.id, status: subscription.status });

  const customerId = subscription.customer as string;
  
  // Get tenant ID from customer metadata or by looking up the customer
  let tenantId = subscription.metadata?.tenant_id;
  
  if (!tenantId) {
    // Try to find tenant by customer ID
    const { data: existingSubscription } = await supabaseClient
      .from("tenant_subscriptions")
      .select("tenant_id")
      .eq("stripe_customer_id", customerId)
      .single();
    
    if (existingSubscription) {
      tenantId = existingSubscription.tenant_id;
    }
  }

  if (!tenantId) {
    logStep("No tenant ID found for subscription", { subscriptionId: subscription.id });
    return;
  }

  // Determine subscription tier from price
  let subscriptionTier = "Basic";
  if (subscription.items.data.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    // You can customize this logic based on your price IDs
    if (priceId.includes("premium")) {
      subscriptionTier = "Premium";
    } else if (priceId.includes("enterprise")) {
      subscriptionTier = "Enterprise";
    }
  }

  const isActive = subscription.status === "active" || subscription.status === "trialing";
  const subscriptionEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;

  // Update tenant_subscriptions
  await supabaseClient
    .from("tenant_subscriptions")
    .upsert({
      tenant_id: tenantId,
      stripe_customer_id: customerId,
      subscribed: isActive,
      subscription_tier: subscriptionTier,
      billing_interval: subscription.items.data[0]?.price.recurring?.interval || "month",
      trial_end: trialEnd,
      subscription_end: subscriptionEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });

  logStep("Updated tenant subscription", { tenantId, subscribed: isActive, tier: subscriptionTier });
}

async function handleSubscriptionDeleted(supabaseClient: any, subscription: Stripe.Subscription) {
  logStep("Handling subscription deletion", { subscriptionId: subscription.id });

  const customerId = subscription.customer as string;

  // Update tenant_subscriptions to mark as unsubscribed
  await supabaseClient
    .from("tenant_subscriptions")
    .update({
      subscribed: false,
      subscription_tier: null,
      subscription_end: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  logStep("Marked subscription as deleted", { customerId });
}

async function handlePaymentSucceeded(supabaseClient: any, invoice: Stripe.Invoice) {
  logStep("Handling payment succeeded", { invoiceId: invoice.id });

  if (invoice.subscription) {
    const customerId = invoice.customer as string;
    
    // Update payment status
    await supabaseClient
      .from("tenant_subscriptions")
      .update({
        subscribed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId);

    logStep("Updated subscription after successful payment", { customerId });
  }
}

async function handlePaymentFailed(supabaseClient: any, invoice: Stripe.Invoice) {
  logStep("Handling payment failed", { invoiceId: invoice.id });

  if (invoice.subscription) {
    const customerId = invoice.customer as string;
    
    // You might want to implement logic here to handle failed payments
    // For now, we'll just log it
    logStep("Payment failed for customer", { customerId });
  }
}

async function handleTrialWillEnd(supabaseClient: any, subscription: Stripe.Subscription) {
  logStep("Handling trial will end", { subscriptionId: subscription.id });
  
  // You can implement notification logic here
  // For now, we'll just log it
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
  logStep("Trial ending soon", { subscriptionId: subscription.id, trialEnd });
}