import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";

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
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabaseClient, stripe, event.data.object as Stripe.Checkout.Session);
        break;

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
  logStep("Handling subscription change", { 
    subscriptionId: subscription.id, 
    status: subscription.status 
  });

  const customerId = subscription.customer as string;
  
  // Get tenant ID from subscription metadata or lookup by customer
  let tenantId = subscription.metadata?.tenant_id;
  
  if (!tenantId) {
    const { data: existingSubscription } = await supabaseClient
      .from("tenant_subscriptions")
      .select("tenant_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    
    if (existingSubscription) {
      tenantId = existingSubscription.tenant_id;
    }
  }

  if (!tenantId) {
    logStep("No tenant ID found for subscription", { subscriptionId: subscription.id });
    return;
  }

  // Map Stripe status to our billing_status
  let billing_status = 'active';
  if (subscription.status === 'trialing') billing_status = 'active'; // Stripe trials are active
  if (subscription.status === 'past_due') billing_status = 'past_due';
  if (subscription.status === 'canceled') billing_status = 'canceled';
  if (subscription.status === 'unpaid') billing_status = 'locked';
  if (subscription.status === 'incomplete') billing_status = 'locked';
  if (subscription.status === 'incomplete_expired') billing_status = 'locked';

  const isSubscribed = ['active', 'trialing'].includes(subscription.status);
  const quantity = subscription.items.data[0]?.quantity || 1;
  const interval = subscription.items.data[0]?.price.recurring?.interval || 'month';
  
  const currentPeriodStart = subscription.current_period_start 
    ? new Date(subscription.current_period_start * 1000).toISOString() 
    : null;
  const currentPeriodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end * 1000).toISOString() 
    : null;

  // Update tenant_subscriptions - CLEAR trial fields since Stripe subscription is now active
  await supabaseClient
    .from("tenant_subscriptions")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscribed: isSubscribed,
      subscription_status: subscription.status,
      billing_status: billing_status,
      billing_interval: interval,
      seat_quantity: quantity,
      current_period_start: currentPeriodStart,
      current_period_end_at: currentPeriodEnd,
      subscription_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      
      // CLEAR DB trial fields - trial is over, subscription is active
      trial_started_at: null,
      trial_ends_at: null,
      trial_source: null,
      
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  logStep("Updated tenant subscription", { 
    tenantId, 
    billing_status, 
    quantity,
    subscribed: isSubscribed 
  });
}

async function handleSubscriptionDeleted(supabaseClient: any, subscription: Stripe.Subscription) {
  logStep("Handling subscription deletion", { subscriptionId: subscription.id });

  const customerId = subscription.customer as string;

  await supabaseClient
    .from("tenant_subscriptions")
    .update({
      subscribed: false,
      billing_status: 'canceled',
      subscription_tier: null,
      subscription_end: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  logStep("Marked subscription as canceled", { customerId });
}

async function handlePaymentSucceeded(supabaseClient: any, invoice: Stripe.Invoice) {
  logStep("Handling payment succeeded", { invoiceId: invoice.id });

  if (invoice.subscription) {
    const customerId = invoice.customer as string;
    
    await supabaseClient
      .from("tenant_subscriptions")
      .update({
        subscribed: true,
        billing_status: 'active',
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
    
    await supabaseClient
      .from("tenant_subscriptions")
      .update({
        billing_status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId);
    
    logStep("Marked subscription as past_due", { customerId });
  }
}

async function handleTrialWillEnd(supabaseClient: any, subscription: Stripe.Subscription) {
  logStep("Handling trial will end", { subscriptionId: subscription.id });
  
  // You can implement notification logic here
  // For now, we'll just log it
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
  logStep("Trial ending soon", { subscriptionId: subscription.id, trialEnd });
}

async function handleCheckoutCompleted(
  supabaseClient: any, 
  stripe: Stripe, 
  session: Stripe.Checkout.Session
) {
  logStep("Handling checkout completed", { sessionId: session.id });

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    logStep("No subscription in checkout session", { sessionId: session.id });
    return;
  }

  // Retrieve full subscription object
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  // Reuse subscription handler to update DB and clear trial fields
  await handleSubscriptionChange(supabaseClient, subscription);
  
  logStep("Checkout session processed", { sessionId: session.id, subscriptionId });
}