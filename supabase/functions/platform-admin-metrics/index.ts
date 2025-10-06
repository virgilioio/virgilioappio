import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../../utils/createSecureEdgeFunction.ts";

const corsHeaders = createSecureCorsHeaders();

serve(async (req) => {
  const preflightResponse = handleSecureCorsPreFlight(req, corsHeaders);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify user is platform admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseClient.auth.getUser(token)
    
    if (error || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is platform admin
    const { data: memberData, error: memberError } = await supabaseClient
      .from('members')
      .select('user_type, member_role')
      .eq('user_id', user.id)
      .single()

    if (memberError || memberData?.user_type !== 'platform_admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Platform admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Fetching platform admin metrics...')

    // Fetch metrics in parallel
    const [
      usersResult,
      organizationsResult, 
      jobsResult,
      candidatesResult,
      jobCandidatesResult,
      invoicesResult,
      activitiesResult
    ] = await Promise.all([
      // Active users (last 30 days)
      supabaseClient
        .from('profiles')
        .select('id, updated_at')
        .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Organizations
      supabaseClient
        .from('organizations')
        .select('id, status, organization_type')
        .eq('status', 'active'),
      
      // Jobs
      supabaseClient
        .from('jobs')
        .select('id, status, created_at'),
      
      // Independent candidates
      supabaseClient
        .from('candidates')
        .select('id, status, created_at'),
      
      // Job candidates
      supabaseClient
        .from('job_candidates')
        .select('id, created_at'),
      
      // Recent invoices (last 3 months)
      supabaseClient
        .from('invoices')
        .select('id, status, amount, currency')
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Recent activities (last 7 days)
      supabaseClient
        .from('activities')
        .select('id, activity_type, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    ])

    // Process users data
    const activeUsers = usersResult.data?.length || 0
    
    // Process organizations data
    const totalOrganizations = organizationsResult.data?.length || 0
    const clientOrganizations = organizationsResult.data?.filter(org => org.organization_type === 'client').length || 0
    
    // Process jobs data
    const totalJobs = jobsResult.data?.length || 0
    const activeJobs = jobsResult.data?.filter(job => job.status === 'active').length || 0
    const draftJobs = jobsResult.data?.filter(job => job.status === 'draft').length || 0
    
    // Process candidates data
    const independentCandidates = candidatesResult.data?.length || 0
    const jobCandidates = jobCandidatesResult.data?.length || 0
    const totalCandidates = independentCandidates + jobCandidates
    
    // Process invoices data
    const recentInvoices = invoicesResult.data?.length || 0
    const paidInvoices = invoicesResult.data?.filter(inv => inv.status === 'paid').length || 0
    const pendingInvoices = invoicesResult.data?.filter(inv => inv.status === 'pending').length || 0
    
    // Process activities data
    const recentActivities = activitiesResult.data?.length || 0
    
    // Calculate growth metrics (simple month-over-month)
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const newJobsThisMonth = jobsResult.data?.filter(job => 
      new Date(job.created_at) >= lastMonth
    ).length || 0
    
    const newCandidatesThisMonth = [
      ...(candidatesResult.data?.filter(candidate => 
        new Date(candidate.created_at) >= lastMonth
      ) || []),
      ...(jobCandidatesResult.data?.filter(candidate => 
        new Date(candidate.created_at) >= lastMonth
      ) || [])
    ].length || 0

    // CoreSignal integration removed

    const metrics = {
      users: {
        active: activeUsers,
        total: activeUsers // For now, using active as total proxy
      },
      organizations: {
        total: totalOrganizations,
        clients: clientOrganizations,
        platform: totalOrganizations - clientOrganizations
      },
      jobs: {
        total: totalJobs,
        active: activeJobs,
        draft: draftJobs,
        newThisMonth: newJobsThisMonth
      },
      candidates: {
        total: totalCandidates,
        independent: independentCandidates,
        jobSpecific: jobCandidates,
        newThisMonth: newCandidatesThisMonth
      },
      invoices: {
        recent: recentInvoices,
        paid: paidInvoices,
        pending: pendingInvoices
      },
      activity: {
        recentActivities: recentActivities
      },
      // CoreSignal API integration removed
      lastUpdated: new Date().toISOString()
    }

    console.log('Platform metrics:', metrics)

    return new Response(
      JSON.stringify(metrics),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error fetching platform metrics:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch platform metrics', details: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})