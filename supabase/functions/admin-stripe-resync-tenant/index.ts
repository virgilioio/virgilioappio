// Per-tenant Stripe ↔ DB resync, gated to platform admins.
// Body: { tenantId?: string, stripeCustomerId?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { reconcileCustomer } from '../_shared/stripeReconcile.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    if (!memberRecord) {
      return new Response(JSON.stringify({ error: 'Forbidden: Platform admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({})) as {
      tenantId?: string
      stripeCustomerId?: string
    }

    let stripeCustomerId = body.stripeCustomerId
    if (!stripeCustomerId && body.tenantId) {
      const { data: sub } = await supabase
        .from('tenant_subscriptions')
        .select('stripe_customer_id')
        .eq('tenant_id', body.tenantId)
        .maybeSingle()
      stripeCustomerId = sub?.stripe_customer_id ?? undefined
    }

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ error: 'No stripe_customer_id found for tenant' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

    const outcome = await reconcileCustomer({
      supabase, stripe,
      stripeCustomerId,
      source: 'admin_resync',
    })

    return new Response(JSON.stringify({ outcome }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('admin-stripe-resync-tenant error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
