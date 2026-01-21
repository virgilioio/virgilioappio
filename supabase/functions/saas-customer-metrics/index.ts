import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityLog {
  id: string
  activity_type: string
  title: string
  description: string | null
  created_at: string
  user_id: string
  entity_type: string | null
  entity_id: string | null
}

interface CustomerMetrics {
  id: string
  name: string
  plan_type: string | null
  status: string
  renewal_date: string | null
  billing_id: string | null
  owner_id: string | null
  organization_type: string
  tenant_type: string
  signup_source: string
  created_at: string
  updated_at: string
  // Total counts
  jobs_total: number
  candidates_total: number
  // 30-day trends
  jobs_created_30d: number
  candidates_added_30d: number
  members_active_count: number
  last_active_at: string | null
  trial_end_date: string | null
  suspended_at: string | null
  suspended_reason: string | null
  owner_details?: {
    first_name: string | null
    last_name: string | null
    email: string | null
  }
  subscription_plan?: string | null
  subscription_renewal_date?: string | null
  billing_email?: string | null
  // Real activity logs
  recent_activities: ActivityLog[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authorization header to verify the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify they're authenticated
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create service role client for cross-tenant queries (and admin check to bypass RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if user is platform admin using service client to bypass RLS
    const { data: memberRecord, error: memberError } = await serviceClient
      .from('members')
      .select('user_type, user_status')
      .eq('user_id', user.id)
      .eq('user_type', 'platform_admin')
      .eq('user_status', 'active')
      .maybeSingle()

    console.log('Platform admin check for user:', user.id, 'Result:', memberRecord)

    if (memberError || !memberRecord) {
      console.error('Not platform admin:', memberError || 'No platform_admin membership found for user ' + user.id)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body for optional customerId filter
    let customerId: string | null = null
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      customerId = body.customerId || null
    }

    console.log('Fetching SaaS customer metrics', { customerId })

    // Query to get SaaS tenants
    let tenantsQuery = serviceClient
      .from('tenants')
      .select('*')
      .eq('tenant_type', 'saas')

    if (customerId) {
      tenantsQuery = tenantsQuery.eq('id', customerId)
    }

    const { data: tenants, error: tenantsError } = await tenantsQuery.order('created_at', { ascending: false })

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError)
      throw tenantsError
    }

    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ customers: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tenant subscriptions
    const tenantIds = tenants.map(t => t.id)
    const { data: subscriptions } = await serviceClient
      .from('tenant_subscriptions')
      .select('tenant_id, billing_status, subscription_tier')
      .in('tenant_id', tenantIds)

    const subscriptionMap = new Map(
      (subscriptions || []).map(sub => [sub.tenant_id, sub])
    )

    // Get metrics for each tenant
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const customersWithMetrics: CustomerMetrics[] = await Promise.all(
      tenants.map(async (tenant) => {
        try {
          // Get all jobs for this tenant (not deleted)
          const { data: allJobs } = await serviceClient
            .from('jobs')
            .select('id, created_at')
            .eq('tenant_id', tenant.id)
            .is('deleted_at', null)

          const jobIds = allJobs?.map(j => j.id) || []
          const totalJobs = allJobs?.length || 0
          const jobsIn30Days = allJobs?.filter(j => j.created_at >= thirtyDaysAgo).length || 0

          // Get metrics in parallel
          const [
            allCandidateAssociationsResult,
            recentCandidateAssociationsResult,
            { count: membersCount },
            lastActivityResult,
            ownerProfileResult,
            recentActivitiesResult
          ] = await Promise.all([
            // Total candidate associations (all time)
            jobIds.length > 0
              ? serviceClient
                  .from('job_candidate_associations')
                  .select('candidate_id')
                  .in('job_id', jobIds)
              : Promise.resolve({ data: [] }),

            // Candidate associations in last 30 days
            jobIds.length > 0
              ? serviceClient
                  .from('job_candidate_associations')
                  .select('candidate_id')
                  .in('job_id', jobIds)
                  .gte('created_at', thirtyDaysAgo)
              : Promise.resolve({ data: [] }),

            // Active members count
            serviceClient
              .from('members')
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenant.id)
              .eq('user_status', 'active'),

            // Last activity
            serviceClient
              .from('activities')
              .select('created_at')
              .eq('tenant_id', tenant.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),

            // Owner details
            tenant.owner_id
              ? serviceClient
                  .from('profiles')
                  .select('first_name, last_name, email')
                  .eq('user_id', tenant.owner_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),

            // Recent activities (last 50)
            serviceClient
              .from('activities')
              .select('id, activity_type, title, description, created_at, user_id, entity_type, entity_id')
              .eq('tenant_id', tenant.id)
              .order('created_at', { ascending: false })
              .limit(50)
          ])

          // Count distinct candidates (total and 30-day)
          const totalCandidates = new Set(
            (allCandidateAssociationsResult.data || []).map((a: any) => a.candidate_id)
          ).size
          const candidatesIn30Days = new Set(
            (recentCandidateAssociationsResult.data || []).map((a: any) => a.candidate_id)
          ).size

          const subscription = subscriptionMap.get(tenant.id)

          return {
            id: tenant.id,
            name: tenant.name,
            plan_type: subscription?.subscription_tier || tenant.subscription_plan,
            status: subscription?.billing_status || tenant.status,
            renewal_date: tenant.subscription_renewal_date,
            billing_id: tenant.billing_email,
            owner_id: tenant.owner_id,
            organization_type: 'client',
            tenant_type: tenant.tenant_type,
            signup_source: tenant.signup_source || 'unknown',
            created_at: tenant.created_at,
            updated_at: tenant.updated_at,
            // Total counts
            jobs_total: totalJobs,
            candidates_total: totalCandidates,
            // 30-day trends
            jobs_created_30d: jobsIn30Days,
            candidates_added_30d: candidatesIn30Days,
            members_active_count: membersCount || 0,
            last_active_at: lastActivityResult.data?.created_at || null,
            trial_end_date: tenant.trial_ends_at,
            suspended_at: tenant.suspended_at,
            suspended_reason: tenant.suspended_reason,
            owner_details: ownerProfileResult.data || undefined,
            subscription_plan: tenant.subscription_plan,
            subscription_renewal_date: tenant.subscription_renewal_date,
            billing_email: tenant.billing_email,
            // Real activity logs
            recent_activities: (recentActivitiesResult.data || []) as ActivityLog[],
          } as CustomerMetrics
        } catch (err) {
          console.error('Error fetching metrics for tenant:', tenant.id, err)
          const subscription = subscriptionMap.get(tenant.id)
          return {
            id: tenant.id,
            name: tenant.name,
            plan_type: subscription?.subscription_tier || tenant.subscription_plan,
            status: subscription?.billing_status || tenant.status,
            renewal_date: tenant.subscription_renewal_date,
            billing_id: tenant.billing_email,
            owner_id: tenant.owner_id,
            organization_type: 'client',
            tenant_type: tenant.tenant_type,
            signup_source: tenant.signup_source || 'unknown',
            created_at: tenant.created_at,
            updated_at: tenant.updated_at,
            jobs_total: 0,
            candidates_total: 0,
            jobs_created_30d: 0,
            candidates_added_30d: 0,
            members_active_count: 0,
            last_active_at: null,
            trial_end_date: tenant.trial_ends_at,
            suspended_at: tenant.suspended_at,
            suspended_reason: tenant.suspended_reason,
            recent_activities: [],
          } as CustomerMetrics
        }
      })
    )

    console.log(`Successfully fetched metrics for ${customersWithMetrics.length} customers`)

    return new Response(
      JSON.stringify({ customers: customersWithMetrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in saas-customer-metrics:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
