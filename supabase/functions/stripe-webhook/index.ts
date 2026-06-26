import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@16";
import { createClient } from "jsr:@supabase/supabase-js@2";
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

    // Verify the webhook signature (must use async variant in Deno — SubtleCrypto is async-only)
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type, eventId: event.id });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      logStep("Webhook signature verification failed", { error: errMsg });
      // Log signature failures for observability so they show up in stripe_webhook_events
      try {
        await supabaseClient.from("stripe_webhook_events").insert({
          stripe_event_id: `sig_fail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          event_type: 'signature_verification_failed',
          source: 'webhook',
          action: 'signature_failed',
          error: errMsg,
        });
      } catch (_logErr) {
        // best-effort logging only
      }
      return new Response(`Webhook signature verification failed: ${errMsg}`, { status: 400 });
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

    // Extract customer id (best-effort) from event payload for observability.
    const eventObject = event.data.object as any;
    const eventCustomerId: string | null =
      typeof eventObject?.customer === 'string'
        ? eventObject.customer
        : (eventObject?.customer?.id ?? null);

    // Best-effort resolve tenant_id from the customer so the event row is filterable by tenant.
    let resolvedTenantId: string | null = null;
    if (eventCustomerId) {
      const { data: tenantRow } = await supabaseClient
        .from("tenant_subscriptions")
        .select("tenant_id")
        .eq("stripe_customer_id", eventCustomerId)
        .maybeSingle();
      resolvedTenantId = tenantRow?.tenant_id ?? null;
    }

    // Record the event as being processed
    await supabaseClient
      .from("stripe_webhook_events")
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        source: 'webhook',
        action: 'received',
        stripe_customer_id: eventCustomerId,
        tenant_id: resolvedTenantId,
      });

    logStep("Processing event", { eventType: event.type, customerId: eventCustomerId });

    let handlerError: string | null = null;
    try {
      // Handle different event types. For subscription/invoice events, we
      // always re-fetch the latest subscription from Stripe to stay idempotent
      // and self-heal out-of-order or missed events.
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(supabaseClient, stripe, event.data.object as Stripe.Checkout.Session);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const incoming = event.data.object as Stripe.Subscription;
          const fresh = await stripe.subscriptions.retrieve(incoming.id).catch(() => incoming);
          await handleSubscriptionChange(supabaseClient, fresh);
          break;
        }

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(supabaseClient, event.data.object as Stripe.Subscription);
          break;

        case "invoice.payment_succeeded":
          await handlePaymentSucceeded(supabaseClient, stripe, event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await handlePaymentFailed(supabaseClient, event.data.object as Stripe.Invoice);
          break;

        case "customer.subscription.trial_will_end":
          await handleTrialWillEnd(supabaseClient, event.data.object as Stripe.Subscription);
          break;

        case "radar.early_fraud_warning.created":
          await handleEarlyFraudWarning(supabaseClient, stripe, event);
          break;

        case "charge.dispute.created":
          await handleDisputeCreated(supabaseClient, stripe, event);
          break;

        case "charge.dispute.closed":
          await handleDisputeClosed(supabaseClient, event);
          break;

        case "charge.refunded":
          await handleChargeRefunded(supabaseClient, event);
          break;

        default:
          logStep("Unhandled event type", { eventType: event.type });
      }
    } catch (handlerErr) {
      handlerError = handlerErr instanceof Error ? handlerErr.message : String(handlerErr);
      logStep("Handler error", { eventType: event.type, error: handlerError });
    }

    // Update the event row with the final outcome.
    await supabaseClient
      .from("stripe_webhook_events")
      .update({
        action: handlerError ? 'error' : 'processed',
        error: handlerError,
      })
      .eq('stripe_event_id', event.id);

    logStep("Event finished", { eventType: event.type, eventId: event.id, ok: !handlerError });

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

  // Per-seat model: no tier mapping needed
  // max_users is null (unlimited - billing handles it)
  const maxUsers = null;

  // Map Stripe status to billing_status
  let billing_status = 'active';
  if (subscription.status === 'trialing') billing_status = 'trialing';
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
  
  // Handle trial dates
  const trialStart = subscription.trial_start 
    ? new Date(subscription.trial_start * 1000).toISOString() 
    : null;
  const trialEnd = subscription.trial_end 
    ? new Date(subscription.trial_end * 1000).toISOString() 
    : null;

  // Update tenant_subscriptions for per-seat model
  const updateData: Record<string, any> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscribed: isSubscribed,
    subscription_status: subscription.status,
    subscription_tier: 'per_seat', // New per-seat model
    max_users: maxUsers, // null = unlimited (per-seat billing)
    billing_status: billing_status,
    billing_interval: interval,
    seat_quantity: quantity,
    current_period_start: currentPeriodStart,
    current_period_end_at: currentPeriodEnd,
    subscription_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  };

  // Handle trial fields based on status
  if (subscription.status === 'trialing') {
    updateData.trial_started_at = trialStart;
    updateData.trial_ends_at = trialEnd;
    updateData.trial_end = trialEnd; // backward compat
  } else if (subscription.status === 'active') {
    // Clear trial fields when subscription is fully active (trial ended)
    updateData.trial_started_at = null;
    updateData.trial_ends_at = null;
    updateData.trial_source = null;
  }

  await supabaseClient
    .from("tenant_subscriptions")
    .update(updateData)
    .eq("tenant_id", tenantId);

  logStep("Updated tenant subscription", { 
    tenantId, 
    billing_status, 
    quantity,
    interval,
    subscribed: isSubscribed,
    isTrialing: subscription.status === 'trialing'
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

async function handlePaymentSucceeded(supabaseClient: any, stripe: Stripe, invoice: Stripe.Invoice) {
  logStep("Handling payment succeeded", { invoiceId: invoice.id });

  // Check if this is a credit bundle purchase (one-time payment)
  const metadata = invoice.metadata || {};
  if (metadata.type === 'credit_bundle' && metadata.tenant_id) {
    const credits = parseInt(metadata.credits || '0', 10);
    const tenantId = metadata.tenant_id;
    
    logStep("Processing credit bundle purchase", { tenantId, credits });
    
    // Record the credit purchase
    await supabaseClient.from("credit_purchases").insert({
      tenant_id: tenantId,
      stripe_payment_id: invoice.payment_intent as string,
      credits_purchased: credits,
      credits_remaining: credits,
      amount_cents: invoice.amount_paid,
      bundle_type: String(credits),
    });

    // Update tenant bonus credits total
    await supabaseClient
      .from("tenant_subscriptions")
      .update({
        bonus_credits_purchased: supabaseClient.raw(`COALESCE(bonus_credits_purchased, 0) + ${credits}`),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    logStep("Credit bundle recorded", { tenantId, credits });
    return;
  }

  // Regular subscription payment
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
  logStep("Handling checkout completed", { sessionId: session.id, mode: session.mode });

  // Handle one-time credit bundle purchase
  if (session.mode === 'payment') {
    const metadata = session.metadata || {};
    if (metadata.type === 'credit_bundle' && metadata.tenant_id) {
      const credits = parseInt(metadata.credits || '0', 10);
      const tenantId = metadata.tenant_id;
      
      logStep("Processing credit bundle from checkout", { tenantId, credits });
      
      // Record the credit purchase
      await supabaseClient.from("credit_purchases").insert({
        tenant_id: tenantId,
        stripe_session_id: session.id,
        stripe_payment_id: session.payment_intent as string,
        credits_purchased: credits,
        credits_remaining: credits,
        amount_cents: session.amount_total || 0,
        bundle_type: String(credits),
      });

      // Update tenant bonus credits total using SQL increment
      const { data: currentData } = await supabaseClient
        .from("tenant_subscriptions")
        .select("bonus_credits_purchased")
        .eq("tenant_id", tenantId)
        .single();

      const currentCredits = currentData?.bonus_credits_purchased || 0;

      await supabaseClient
        .from("tenant_subscriptions")
        .update({
          bonus_credits_purchased: currentCredits + credits,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      logStep("Credit bundle recorded from checkout", { tenantId, credits, totalBonus: currentCredits + credits });
      return;
    }
  }

  // Handle subscription checkout
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    logStep("No subscription in checkout session", { sessionId: session.id });
    return;
  }

  // Retrieve full subscription object
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  // Reuse subscription handler to update DB
  await handleSubscriptionChange(supabaseClient, subscription);
  
  logStep("Checkout session processed", { sessionId: session.id, subscriptionId });
}

// ────────────────────────────────────────────────────────────────────────────
// Fraud handlers
// ────────────────────────────────────────────────────────────────────────────

async function resolveTenantFromCustomer(supabaseClient: any, customerId: string | null) {
  if (!customerId) return null;
  const { data } = await supabaseClient
    .from("tenant_subscriptions")
    .select("tenant_id, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data ?? null;
}

async function suspendTenantForFraud(supabaseClient: any, tenantId: string, reason: string) {
  const nowIso = new Date().toISOString();
  await supabaseClient
    .from("tenant_subscriptions")
    .update({
      billing_status: 'fraud_review',
      subscribed: false,
      suspended_at: nowIso,
      suspended_reason: reason,
      updated_at: nowIso,
    })
    .eq("tenant_id", tenantId);
  await supabaseClient
    .from("tenants")
    .update({
      status: 'suspended',
      suspended_at: nowIso,
      suspended_reason: reason,
      updated_at: nowIso,
    })
    .eq("id", tenantId);
}

async function handleEarlyFraudWarning(supabaseClient: any, stripe: Stripe, event: Stripe.Event) {
  const efw = event.data.object as any; // radar.early_fraud_warning
  logStep("Handling early fraud warning", { id: efw.id, fraud_type: efw.fraud_type, charge: efw.charge });

  // Resolve customer via the charge
  let customerId: string | null = null;
  let chargeId: string | null = typeof efw.charge === 'string' ? efw.charge : (efw.charge?.id ?? null);
  let amount: number | null = null;
  let currency: string | null = null;
  let subscriptionId: string | null = null;
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      customerId = typeof charge.customer === 'string' ? charge.customer : (charge.customer?.id ?? null);
      amount = charge.amount ?? null;
      currency = charge.currency ?? null;
      // Pull subscription via invoice if any
      if (charge.invoice) {
        const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : charge.invoice.id;
        try {
          const inv = await stripe.invoices.retrieve(invoiceId);
          subscriptionId = typeof inv.subscription === 'string' ? inv.subscription : (inv.subscription?.id ?? null);
        } catch (_) { /* noop */ }
      }
    } catch (e) {
      logStep("Failed to retrieve charge", { chargeId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const tenant = await resolveTenantFromCustomer(supabaseClient, customerId);

  // Auto-refund the charge with reason='fraudulent' (lowers future Radar risk score)
  let refundOutcome: any = 'skipped';
  if (chargeId) {
    try {
      const refund = await stripe.refunds.create({ charge: chargeId, reason: 'fraudulent' });
      refundOutcome = { id: refund.id, status: refund.status };
    } catch (e) {
      refundOutcome = { error: e instanceof Error ? e.message : String(e) };
      logStep("Refund failed", refundOutcome);
    }
  }

  // Cancel subscription if we found one
  const subToCancel = subscriptionId ?? tenant?.stripe_subscription_id ?? null;
  let cancelOutcome: any = 'skipped';
  if (subToCancel) {
    try {
      const cancelled = await stripe.subscriptions.cancel(subToCancel, { prorate: false });
      cancelOutcome = { id: cancelled.id, status: cancelled.status };
    } catch (e) {
      cancelOutcome = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Suspend tenant
  if (tenant?.tenant_id) {
    await suspendTenantForFraud(supabaseClient, tenant.tenant_id, 'fraud_signal');
  }

  // Audit log
  await supabaseClient.from("tenant_fraud_signals").insert({
    tenant_id: tenant?.tenant_id ?? null,
    signal_type: 'early_fraud_warning',
    stripe_event_id: event.id,
    stripe_charge_id: chargeId,
    stripe_customer_id: customerId,
    fraud_type: efw.fraud_type ?? null,
    amount_cents: amount,
    currency,
    action_taken: 'refunded',
    raw_event: { efw, refund: refundOutcome, cancel: cancelOutcome },
  });

  logStep("Early fraud warning processed", { tenant: tenant?.tenant_id, refundOutcome, cancelOutcome });
}

async function handleDisputeCreated(supabaseClient: any, stripe: Stripe, event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;
  logStep("Handling dispute created", { id: dispute.id, reason: dispute.reason });

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : (dispute.charge?.id ?? null);
  let customerId: string | null = null;
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      customerId = typeof charge.customer === 'string' ? charge.customer : (charge.customer?.id ?? null);
    } catch (_) { /* noop */ }
  }

  const tenant = await resolveTenantFromCustomer(supabaseClient, customerId);
  if (tenant?.tenant_id) {
    await suspendTenantForFraud(supabaseClient, tenant.tenant_id, 'dispute_filed');
    // Cancel subscription if still active
    if (tenant.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(tenant.stripe_subscription_id, { prorate: false });
      } catch (_) { /* noop */ }
    }
  }

  await supabaseClient.from("tenant_fraud_signals").insert({
    tenant_id: tenant?.tenant_id ?? null,
    signal_type: 'dispute',
    stripe_event_id: event.id,
    stripe_charge_id: chargeId,
    stripe_dispute_id: dispute.id,
    stripe_customer_id: customerId,
    fraud_type: dispute.reason,
    amount_cents: dispute.amount,
    currency: dispute.currency,
    action_taken: 'suspended',
    raw_event: dispute as any,
  });
}

async function handleDisputeClosed(supabaseClient: any, event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;
  logStep("Handling dispute closed", { id: dispute.id, status: dispute.status });

  // We log the outcome but do NOT auto-unsuspend even if won — requires admin review.
  await supabaseClient.from("tenant_fraud_signals").insert({
    tenant_id: null,
    signal_type: 'dispute',
    stripe_event_id: event.id,
    stripe_dispute_id: dispute.id,
    fraud_type: `${dispute.reason}:closed_${dispute.status}`,
    amount_cents: dispute.amount,
    currency: dispute.currency,
    action_taken: 'none',
    raw_event: dispute as any,
  });
}

async function handleChargeRefunded(supabaseClient: any, event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  logStep("Handling charge refunded", { id: charge.id, refunded: charge.refunded });

  const customerId = typeof charge.customer === 'string' ? charge.customer : (charge.customer?.id ?? null);
  const tenant = await resolveTenantFromCustomer(supabaseClient, customerId);

  await supabaseClient.from("tenant_fraud_signals").insert({
    tenant_id: tenant?.tenant_id ?? null,
    signal_type: 'refunded',
    stripe_event_id: event.id,
    stripe_charge_id: charge.id,
    stripe_customer_id: customerId,
    amount_cents: charge.amount_refunded,
    currency: charge.currency,
    action_taken: 'refunded',
    raw_event: charge as any,
  });
}

