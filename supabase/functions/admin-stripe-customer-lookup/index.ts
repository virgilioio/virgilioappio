import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    let { tenantId, stripeCustomerId } = body as {
      tenantId?: string
      stripeCustomerId?: string
    }

    if (!stripeCustomerId && tenantId) {
      const { data: sub } = await serviceClient
        .from('tenant_subscriptions')
        .select('stripe_customer_id')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      stripeCustomerId = sub?.stripe_customer_id ?? undefined
    }

    if (!stripeCustomerId) {
      return new Response(
        JSON.stringify({ error: 'No stripe_customer_id found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

    const [customer, subscriptions, paymentIntents, invoices, checkoutSessions, setupIntents] =
      await Promise.all([
        stripe.customers.retrieve(stripeCustomerId),
        stripe.subscriptions.list({ customer: stripeCustomerId, status: 'all', limit: 10 }),
        stripe.paymentIntents.list({ customer: stripeCustomerId, limit: 10 }),
        stripe.invoices.list({ customer: stripeCustomerId, limit: 10 }),
        stripe.checkout.sessions.list({ customer: stripeCustomerId, limit: 5 }),
        stripe.setupIntents.list({ customer: stripeCustomerId, limit: 5 }),
      ])

    const result = {
      stripeCustomerId,
      customer: 'deleted' in customer && customer.deleted
        ? { deleted: true }
        : {
            id: (customer as Stripe.Customer).id,
            email: (customer as Stripe.Customer).email,
            name: (customer as Stripe.Customer).name,
            created: new Date((customer as Stripe.Customer).created * 1000).toISOString(),
            default_payment_method:
              (customer as Stripe.Customer).invoice_settings?.default_payment_method,
            currency: (customer as Stripe.Customer).currency,
            balance: (customer as Stripe.Customer).balance,
            delinquent: (customer as Stripe.Customer).delinquent,
          },
      subscriptions: subscriptions.data.map((s) => ({
        id: s.id,
        status: s.status,
        created: new Date(s.created * 1000).toISOString(),
        current_period_start: new Date(s.current_period_start * 1000).toISOString(),
        current_period_end: new Date(s.current_period_end * 1000).toISOString(),
        cancel_at_period_end: s.cancel_at_period_end,
        items: s.items.data.map((i) => ({
          price_id: i.price.id,
          product: typeof i.price.product === 'string' ? i.price.product : i.price.product?.id,
          amount: i.price.unit_amount,
          currency: i.price.currency,
          interval: i.price.recurring?.interval,
          quantity: i.quantity,
        })),
        latest_invoice:
          typeof s.latest_invoice === 'string' ? s.latest_invoice : s.latest_invoice?.id,
      })),
      payment_intents: paymentIntents.data.map((p) => ({
        id: p.id,
        status: p.status,
        amount: p.amount,
        currency: p.currency,
        created: new Date(p.created * 1000).toISOString(),
        description: p.description,
        last_payment_error: p.last_payment_error?.message,
      })),
      invoices: invoices.data.map((i) => ({
        id: i.id,
        status: i.status,
        amount_paid: i.amount_paid,
        amount_due: i.amount_due,
        currency: i.currency,
        created: new Date(i.created * 1000).toISOString(),
        hosted_invoice_url: i.hosted_invoice_url,
        subscription:
          typeof i.subscription === 'string' ? i.subscription : i.subscription?.id,
        billing_reason: i.billing_reason,
      })),
      checkout_sessions: checkoutSessions.data.map((c) => ({
        id: c.id,
        status: c.status,
        payment_status: c.payment_status,
        mode: c.mode,
        created: new Date(c.created * 1000).toISOString(),
        amount_total: c.amount_total,
        currency: c.currency,
        subscription:
          typeof c.subscription === 'string' ? c.subscription : c.subscription?.id,
      })),
      setup_intents: setupIntents.data.map((s) => ({
        id: s.id,
        status: s.status,
        created: new Date(s.created * 1000).toISOString(),
        payment_method:
          typeof s.payment_method === 'string' ? s.payment_method : s.payment_method?.id,
      })),
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-stripe-customer-lookup error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message, stack: (err as Error).stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
