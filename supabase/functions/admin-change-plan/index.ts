import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChangePlanRequest {
  organizationId: string
  newTier: string
  newInterval: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create authenticated Supabase client
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is platform admin
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('user_type')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single()

    if (memberError || memberData?.user_type !== 'platform_admin') {
      console.error('Permission check failed:', memberError)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { organizationId, newTier, newInterval }: ChangePlanRequest = await req.json()

    if (!organizationId || !newTier || !newInterval) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organizationId, newTier, newInterval' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Changing plan for organization:', organizationId, 'to', newTier, newInterval)

    // Create service role client for privileged operations
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, serviceKey)

    // Get tenant_id from organization
    const { data: orgData, error: orgError } = await serviceClient
      .from('organizations')
      .select('tenant_id')
      .eq('id', organizationId)
      .single()

    if (orgError || !orgData?.tenant_id) {
      console.error('Organization lookup error:', orgError)
      return new Response(
        JSON.stringify({ error: 'Organization not found or has no tenant_id' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantId = orgData.tenant_id

    // Validate tier and interval
    const validTiers = ['launch', 'growth', 'business']
    const validIntervals = ['monthly', 'yearly']

    if (!validTiers.includes(newTier.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier. Must be one of: launch, growth, business' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!validIntervals.includes(newInterval.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid interval. Must be one of: monthly, yearly' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update tenant_subscriptions table
    const { data: updateData, error: updateError } = await serviceClient
      .from('tenant_subscriptions')
      .update({
        subscription_tier: newTier.toLowerCase(),
        billing_interval: newInterval.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (updateError) {
      console.error('Subscription update error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully updated subscription:', updateData)

    // TODO: In the future, sync with Stripe if stripe_subscription_id exists
    // This would involve calling Stripe API to update the subscription
    // For now, we just update the database

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Plan changed successfully',
        data: {
          tenantId,
          newTier: newTier.toLowerCase(),
          newInterval: newInterval.toLowerCase(),
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in admin-change-plan:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
