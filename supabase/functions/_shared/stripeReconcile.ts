// Shared Stripe ↔ tenant_subscriptions reconciliation logic.
// Used by both the periodic reconciler and the per-tenant admin resync.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

export type ReconcileOutcome =
  | { action: 'no_change'; tenantId: string | null; stripeStatus: string | null; dbStatus: string | null }
  | { action: 'healed'; tenantId: string; stripeStatus: string; previousDbStatus: string | null; subscriptionId: string }
  | { action: 'cancelled_in_db'; tenantId: string; previousDbStatus: string | null }
  | { action: 'no_tenant'; stripeCustomerId: string }
  | { action: 'error'; tenantId: string | null; stripeCustomerId: string; error: string }

function mapBillingStatus(status: string): string {
  switch (status) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    case 'canceled': return 'canceled'
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'locked'
    default: return 'active'
  }
}

export async function reconcileCustomer(params: {
  supabase: any
  stripe: Stripe
  stripeCustomerId: string
  source: 'reconciler' | 'admin_resync'
}): Promise<ReconcileOutcome> {
  const { supabase, stripe, stripeCustomerId, source } = params

  try {
    // Lookup tenant_subscription row for this Stripe customer.
    const { data: tenantSub } = await supabase
      .from('tenant_subscriptions')
      .select('tenant_id, billing_status, stripe_subscription_id, current_period_end_at, subscribed')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle()

    if (!tenantSub?.tenant_id) {
      await logEvent(supabase, {
        source,
        action: 'no_tenant',
        stripeCustomerId,
        tenantId: null,
        details: { reason: 'No tenant_subscription matched this Stripe customer.' },
      })
      return { action: 'no_tenant', stripeCustomerId }
    }

    const tenantId: string = tenantSub.tenant_id
    const previousDbStatus: string | null = tenantSub.billing_status ?? null

    // Pull the most recent subscription from Stripe.
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 5,
    })

    // Pick the "best" subscription: prefer active/trialing/past_due, else most recent.
    const sorted = [...subs.data].sort((a, b) => b.created - a.created)
    const live = sorted.find(s => ['active', 'trialing', 'past_due'].includes(s.status)) ?? sorted[0]

    if (!live) {
      // No subscription on Stripe at all.
      if (tenantSub.subscribed === true || ['active', 'trialing', 'past_due'].includes(previousDbStatus ?? '')) {
        await supabase
          .from('tenant_subscriptions')
          .update({
            subscribed: false,
            billing_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)

        await logEvent(supabase, {
          source,
          action: 'cancelled_in_db',
          stripeCustomerId,
          tenantId,
          details: { previousDbStatus },
        })
        return { action: 'cancelled_in_db', tenantId, previousDbStatus }
      }
      await logEvent(supabase, {
        source,
        action: 'no_change',
        stripeCustomerId,
        tenantId,
        details: { reason: 'No Stripe subscription, DB already inactive', previousDbStatus },
      })
      return { action: 'no_change', tenantId, stripeStatus: null, dbStatus: previousDbStatus }
    }

    const stripeStatus = live.status
    const desiredBilling = mapBillingStatus(stripeStatus)
    const isSubscribed = ['active', 'trialing'].includes(stripeStatus)
    const quantity = live.items.data[0]?.quantity || 1
    const interval = live.items.data[0]?.price.recurring?.interval || 'month'
    const currentPeriodStart = live.current_period_start
      ? new Date(live.current_period_start * 1000).toISOString() : null
    const currentPeriodEnd = live.current_period_end
      ? new Date(live.current_period_end * 1000).toISOString() : null

    // Detect drift: status mismatch OR missing sub id OR period end out of sync (>1 day).
    const dbPeriodEnd = tenantSub.current_period_end_at ? new Date(tenantSub.current_period_end_at).getTime() : 0
    const stripePeriodEnd = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : 0
    const periodDriftDays = Math.abs(dbPeriodEnd - stripePeriodEnd) / (1000 * 60 * 60 * 24)

    const drifted =
      previousDbStatus !== desiredBilling ||
      tenantSub.stripe_subscription_id !== live.id ||
      tenantSub.subscribed !== isSubscribed ||
      periodDriftDays > 1

    if (!drifted) {
      return { action: 'no_change', tenantId, stripeStatus, dbStatus: previousDbStatus }
    }

    const updateData: Record<string, any> = {
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: live.id,
      subscribed: isSubscribed,
      subscription_status: stripeStatus,
      subscription_tier: 'per_seat',
      max_users: null,
      billing_status: desiredBilling,
      billing_interval: interval,
      seat_quantity: quantity,
      current_period_start: currentPeriodStart,
      current_period_end_at: currentPeriodEnd,
      subscription_end: currentPeriodEnd,
      cancel_at_period_end: live.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    }

    if (stripeStatus === 'trialing') {
      updateData.trial_started_at = live.trial_start
        ? new Date(live.trial_start * 1000).toISOString() : null
      updateData.trial_ends_at = live.trial_end
        ? new Date(live.trial_end * 1000).toISOString() : null
      updateData.trial_end = updateData.trial_ends_at
    } else if (stripeStatus === 'active') {
      updateData.trial_started_at = null
      updateData.trial_ends_at = null
      updateData.trial_source = null
    }

    await supabase.from('tenant_subscriptions').update(updateData).eq('tenant_id', tenantId)

    await logEvent(supabase, {
      source,
      action: 'healed',
      stripeCustomerId,
      tenantId,
      details: {
        previousDbStatus,
        newDbStatus: desiredBilling,
        stripeStatus,
        subscriptionId: live.id,
        periodDriftDays: Number(periodDriftDays.toFixed(2)),
      },
    })

    return {
      action: 'healed',
      tenantId,
      stripeStatus,
      previousDbStatus,
      subscriptionId: live.id,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logEvent(supabase, {
      source,
      action: 'error',
      stripeCustomerId,
      tenantId: null,
      error: message,
    })
    return { action: 'error', tenantId: null, stripeCustomerId, error: message }
  }
}

async function logEvent(supabase: any, params: {
  source: 'reconciler' | 'admin_resync'
  action: string
  stripeCustomerId: string
  tenantId: string | null
  error?: string
  details?: Record<string, unknown>
}) {
  const syntheticId = `${params.source}:${params.stripeCustomerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  try {
    await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: syntheticId,
      event_type: `${params.source}.${params.action}`,
      source: params.source,
      action: params.action,
      stripe_customer_id: params.stripeCustomerId,
      tenant_id: params.tenantId,
      error: params.error ?? null,
      details: params.details ?? null,
    })
  } catch (logErr) {
    console.error('[stripeReconcile] failed to log event', logErr)
  }
}
