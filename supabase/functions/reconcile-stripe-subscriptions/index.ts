// Periodic Stripe ↔ tenant_subscriptions reconciler.
// Triggered by pg_cron every 6h. Walks tenants in batches and heals drift.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { reconcileCustomer } from '../_shared/stripeReconcile.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 50

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Optional payload: { cursor?: string, limit?: number, customerId?: string }
    const body = await req.json().catch(() => ({})) as {
      cursor?: string
      limit?: number
      customerId?: string
    }

    // Single-customer mode (useful for manual triggers / cron retries).
    if (body.customerId) {
      const outcome = await reconcileCustomer({
        supabase, stripe,
        stripeCustomerId: body.customerId,
        source: 'reconciler',
      })
      return new Response(JSON.stringify({ outcome }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const limit = Math.min(body.limit ?? BATCH_SIZE, 200)
    let query = supabase
      .from('tenant_subscriptions')
      .select('tenant_id, stripe_customer_id')
      .not('stripe_customer_id', 'is', null)
      .order('tenant_id', { ascending: true })
      .limit(limit)

    if (body.cursor) {
      query = query.gt('tenant_id', body.cursor)
    }

    const { data: rows, error } = await query
    if (error) throw error

    const results = { processed: 0, healed: 0, cancelled: 0, noChange: 0, errors: 0, noTenant: 0 }
    let lastTenantId: string | null = null

    for (const row of rows ?? []) {
      lastTenantId = row.tenant_id
      const outcome = await reconcileCustomer({
        supabase, stripe,
        stripeCustomerId: row.stripe_customer_id as string,
        source: 'reconciler',
      })
      results.processed += 1
      if (outcome.action === 'healed') results.healed += 1
      else if (outcome.action === 'cancelled_in_db') results.cancelled += 1
      else if (outcome.action === 'no_change') results.noChange += 1
      else if (outcome.action === 'error') results.errors += 1
      else if (outcome.action === 'no_tenant') results.noTenant += 1
    }

    const hasMore = (rows?.length ?? 0) === limit
    return new Response(
      JSON.stringify({ results, nextCursor: hasMore ? lastTenantId : null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[reconcile-stripe-subscriptions] fatal', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
