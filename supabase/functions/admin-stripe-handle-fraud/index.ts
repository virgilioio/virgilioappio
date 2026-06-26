// Platform admin tool to handle a fraud signal on a tenant.
// Body: { tenantId: string, chargeId?: string, action: 'refund_and_suspend' | 'suspend_only' | 'clear' }
//
// - refund_and_suspend (default for early_fraud_warning):
//     * Refund the charge in Stripe with reason='fraudulent'
//     * Cancel the active subscription
//     * Mark tenant_subscriptions.billing_status = 'fraud_review'
//     * Suspend the tenant
//     * Log a tenant_fraud_signals row (manual_flag, action_taken='refunded')
// - suspend_only:
//     * Same as above, minus the refund
// - clear:
//     * Resolve all open fraud signals for the tenant (does NOT auto-unsuspend)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: memberRecord } = await supabase
      .from('members')
      .select('user_type, user_status')
      .eq('user_id', user.id)
      .eq('user_type', 'platform_admin')
      .eq('user_status', 'active')
      .maybeSingle()

    if (!memberRecord) return json({ error: 'Forbidden: Platform admin access required' }, 403)

    const body = await req.json().catch(() => ({})) as {
      tenantId?: string
      chargeId?: string
      action?: 'refund_and_suspend' | 'suspend_only' | 'clear'
      notes?: string
    }

    const tenantId = body.tenantId
    const action = body.action ?? 'refund_and_suspend'
    if (!tenantId) return json({ error: 'tenantId is required' }, 400)

    // CLEAR — just resolve open signals; do not change billing/suspension state.
    if (action === 'clear') {
      const { error: updErr } = await supabase
        .from('tenant_fraud_signals')
        .update({ resolved_at: new Date().toISOString(), resolved_by: user.id, notes: body.notes ?? null })
        .eq('tenant_id', tenantId)
        .is('resolved_at', null)
      if (updErr) return json({ error: updErr.message }, 500)
      return json({ ok: true, action: 'cleared' }, 200)
    }

    // Fetch tenant + subscription
    const { data: sub } = await supabase
      .from('tenant_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      return json({ error: 'Tenant has no Stripe customer to act on' }, 400)
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY not configured' }, 500)
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

    const outcome: Record<string, unknown> = { tenantId, action }

    // 1. Refund (refund_and_suspend only)
    if (action === 'refund_and_suspend') {
      let chargeId = body.chargeId
      // If no chargeId supplied, refund the most recent successful charge on this customer.
      if (!chargeId) {
        const charges = await stripe.charges.list({ customer: sub.stripe_customer_id, limit: 5 })
        const target = charges.data.find((c) => c.paid && !c.refunded && c.amount_refunded < c.amount)
        chargeId = target?.id
      }
      if (chargeId) {
        try {
          const refund = await stripe.refunds.create({
            charge: chargeId,
            reason: 'fraudulent',
          })
          outcome.refund = { id: refund.id, status: refund.status, amount: refund.amount, charge: chargeId }
        } catch (e) {
          outcome.refund_error = e instanceof Error ? e.message : String(e)
        }
      } else {
        outcome.refund = 'no_eligible_charge_found'
      }
    }

    // 2. Cancel subscription if present
    if (sub.stripe_subscription_id) {
      try {
        const cancelled = await stripe.subscriptions.cancel(sub.stripe_subscription_id, {
          prorate: false,
        })
        outcome.subscription_cancelled = { id: cancelled.id, status: cancelled.status }
      } catch (e) {
        outcome.cancel_error = e instanceof Error ? e.message : String(e)
      }
    }

    // 3. Mark workspace
    const nowIso = new Date().toISOString()
    await supabase
      .from('tenant_subscriptions')
      .update({
        billing_status: 'fraud_review',
        subscribed: false,
        suspended_at: nowIso,
        suspended_reason: 'fraud_signal',
        updated_at: nowIso,
      })
      .eq('tenant_id', tenantId)

    await supabase
      .from('tenants')
      .update({
        status: 'suspended',
        suspended_at: nowIso,
        suspended_reason: 'fraud_signal',
        updated_at: nowIso,
      })
      .eq('id', tenantId)

    // 4. Log the signal
    await supabase.from('tenant_fraud_signals').insert({
      tenant_id: tenantId,
      signal_type: 'manual_flag',
      stripe_charge_id: body.chargeId ?? null,
      stripe_customer_id: sub.stripe_customer_id,
      action_taken: action === 'refund_and_suspend' ? 'refunded' : 'suspended',
      notes: body.notes ?? `Manual admin action: ${action}`,
      raw_event: { manual: true, action, by_user: user.id, outcome },
    })

    outcome.suspended = true
    return json({ ok: true, outcome }, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('admin-stripe-handle-fraud error:', msg)
    return json({ error: msg }, 500)
  }
})

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
