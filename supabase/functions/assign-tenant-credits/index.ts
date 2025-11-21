import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssignCreditsRequest {
  tenant_id: string
  search_credits_limit?: number
  collect_credits_limit?: number
  reset_usage?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Auth check: Only platform admins
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify platform admin
    const { data: member } = await supabase
      .from('members')
      .select('user_type')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single()

    if (member?.user_type !== 'platform_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Platform admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { tenant_id, search_credits_limit, collect_credits_limit, reset_usage }: AssignCreditsRequest = await req.json()

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build update object
    const updates: any = { updated_at: new Date().toISOString() }
    
    if (search_credits_limit !== undefined) {
      updates.search_credits_limit = search_credits_limit
    }
    
    if (collect_credits_limit !== undefined) {
      updates.collect_credits_limit = collect_credits_limit
    }

    if (reset_usage) {
      updates.search_credits_used = 0
      updates.collect_credits_used = 0
    }

    // Get most recent usage record for this tenant
    const { data: existingUsage } = await supabase
      .from('coresignal_usage')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let result

    if (existingUsage) {
      // Update existing record
      const { data, error } = await supabase
        .from('coresignal_usage')
        .update(updates)
        .eq('id', existingUsage.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Create new record if none exists
      const { data: subscription } = await supabase
        .from('tenant_subscriptions')
        .select('current_period_start, trial_started_at, billing_status')
        .eq('tenant_id', tenant_id)
        .single()

      let billingCycleStart = new Date()
      if (subscription?.billing_status === 'trialing' && subscription.trial_started_at) {
        billingCycleStart = new Date(subscription.trial_started_at)
      } else if (subscription?.current_period_start) {
        billingCycleStart = new Date(subscription.current_period_start)
      }

      const { data, error } = await supabase
        .from('coresignal_usage')
        .insert({
          tenant_id,
          billing_cycle_start: billingCycleStart.toISOString(),
          search_credits_limit: search_credits_limit ?? 25,
          collect_credits_limit: collect_credits_limit ?? 10,
          search_credits_used: 0,
          collect_credits_used: 0,
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    console.log(`✅ Credits assigned for tenant ${tenant_id}: search=${search_credits_limit}, collect=${collect_credits_limit}, reset=${reset_usage}`)

    return new Response(JSON.stringify({
      success: true,
      usage: result,
      message: reset_usage 
        ? 'Credits assigned and usage reset successfully'
        : 'Credits assigned successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Error assigning credits:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
