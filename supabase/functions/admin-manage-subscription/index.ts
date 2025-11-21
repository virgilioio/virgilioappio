import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ManageSubscriptionRequest {
  action: 'suspend' | 'restore' | 'activate' | 'change_plan' | 'extend_trial'
  tenantId: string
  params?: {
    reason?: string
    newEndDate?: string
    newTier?: string
    newInterval?: string
  }
}

interface AuditLogParams {
  action: string
  userId: string
  tenantId: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
}

async function logAuditEvent(client: any, params: AuditLogParams) {
  try {
    await client.rpc('log_audit_event', {
      p_action: params.action,
      p_table_name: 'tenant_subscriptions',
      p_record_id: params.tenantId,
      p_user_id: params.userId,
      p_old_values: params.oldValues || null,
      p_new_values: params.newValues || null,
    })
  } catch (error) {
    console.error('Audit logging failed:', error)
    // Don't throw - audit failure shouldn't block the operation
  }
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
    const { action, tenantId, params }: ManageSubscriptionRequest = await req.json()

    if (!action || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Managing subscription:', { action, tenantId, params })

    // Create service role client for privileged operations
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, serviceKey)

    // Get current subscription data for audit logging
    const { data: currentSub, error: currentSubError } = await serviceClient
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (currentSubError) {
      console.error('Subscription lookup error:', currentSubError)
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    let auditAction = ''

    // Process action
    switch (action) {
      case 'suspend':
        if (!params?.reason) {
          return new Response(
            JSON.stringify({ error: 'Reason required for suspension' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        updateData = {
          ...updateData,
          billing_status: 'locked',
          suspended_at: new Date().toISOString(),
          suspended_reason: params.reason,
        }
        auditAction = 'tenant_subscription_suspended'
        break

      case 'restore':
        // Determine proper billing_status to restore to
        const now = new Date()
        const trialEndsAt = currentSub.trial_ends_at ? new Date(currentSub.trial_ends_at) : null
        const isTrialing = trialEndsAt && trialEndsAt > now
        const billingStatus = isTrialing ? 'trialing' : (currentSub.subscription_status || 'active')
        
        updateData = {
          ...updateData,
          billing_status: billingStatus,
          suspended_at: null,
          suspended_reason: null,
        }
        auditAction = 'tenant_subscription_restored'
        break

      case 'activate':
        updateData = {
          ...updateData,
          billing_status: 'active',
          suspended_at: null,
          suspended_reason: null,
        }
        auditAction = 'tenant_subscription_activated'
        break

      case 'change_plan':
        if (!params?.newTier || !params?.newInterval) {
          return new Response(
            JSON.stringify({ error: 'newTier and newInterval required for plan change' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const validTiers = ['launch', 'growth', 'business']
        const validIntervals = ['monthly', 'yearly']

        if (!validTiers.includes(params.newTier.toLowerCase())) {
          return new Response(
            JSON.stringify({ error: 'Invalid tier. Must be one of: launch, growth, business' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!validIntervals.includes(params.newInterval.toLowerCase())) {
          return new Response(
            JSON.stringify({ error: 'Invalid interval. Must be one of: monthly, yearly' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Set max_users based on tier
        const tierMaxUsers: Record<string, number | null> = {
          launch: 5,
          growth: 20,
          business: null, // unlimited
        }

        updateData = {
          ...updateData,
          subscription_tier: params.newTier.toLowerCase(),
          billing_interval: params.newInterval.toLowerCase(),
          max_users: tierMaxUsers[params.newTier.toLowerCase()],
        }
        auditAction = 'tenant_subscription_plan_changed'
        break

      case 'extend_trial':
        if (!params?.newEndDate) {
          return new Response(
            JSON.stringify({ error: 'newEndDate required for trial extension' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        updateData = {
          ...updateData,
          trial_ends_at: params.newEndDate,
          billing_status: 'trialing',
        }
        auditAction = 'tenant_subscription_trial_extended'
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Perform the update
    const { data: updatedSub, error: updateError } = await serviceClient
      .from('tenant_subscriptions')
      .update(updateData)
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

    // Log audit event
    await logAuditEvent(serviceClient, {
      action: auditAction,
      userId: user.id,
      tenantId,
      oldValues: currentSub,
      newValues: updatedSub,
    })

    console.log('Successfully updated subscription:', updatedSub)

    // For activate action, also update organizations.status
    if (action === 'activate') {
      await serviceClient
        .from('organizations')
        .update({ status: 'active' })
        .eq('tenant_id', tenantId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Subscription ${action} completed successfully`,
        data: updatedSub,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in admin-manage-subscription:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
