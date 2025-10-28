import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: orgData, error: orgError } = await supabase
      .from('members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single();

    if (orgError || !orgData) {
      return new Response(JSON.stringify({ error: 'No active organization found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant subscription for billing period dates
    const { data: tenantData, error: tenantError } = await supabase
      .from('organizations')
      .select('tenant_id')
      .eq('id', orgData.organization_id)
      .single();

    if (tenantError || !tenantData?.tenant_id) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscriptionData } = await supabase
      .from('tenant_subscriptions')
      .select('trial_started_at, subscription_start, billing_interval')
      .eq('tenant_id', tenantData.tenant_id)
      .single();

    // Determine billing period start
    let periodStart: Date;
    const now = new Date();

    if (subscriptionData?.subscription_start) {
      const subStart = new Date(subscriptionData.subscription_start);
      const interval = subscriptionData.billing_interval === 'year' ? 12 : 1;
      
      // Calculate current period based on subscription start
      let periodStartCandidate = new Date(subStart);
      while (periodStartCandidate <= now) {
        periodStart = new Date(periodStartCandidate);
        periodStartCandidate.setMonth(periodStartCandidate.getMonth() + interval);
      }
    } else if (subscriptionData?.trial_started_at) {
      periodStart = new Date(subscriptionData.trial_started_at);
    } else {
      // Fallback to 30 days ago
      periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 30);
    }

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + (subscriptionData?.billing_interval === 'year' ? 12 : 1));

    // Get jobs created in period
    const { count: jobsCreated } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgData.organization_id)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', now.toISOString());

    // Get candidates added in period (via job_candidate_associations)
    const { count: candidatesAdded } = await supabase
      .from('job_candidate_associations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', now.toISOString());

    // Get active members count
    const { count: activeMembers } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgData.organization_id)
      .eq('user_status', 'active');

    // Get billable seats using RPC
    const { data: seatsData, error: seatsError } = await supabase.rpc('get_tenant_billable_seat_count', {
      tenant_id_param: tenantData.tenant_id
    });

    const billableSeats = seatsError ? 0 : (seatsData || 0);

    // Get emails sent (from email_logs)
    const { count: emailsSent } = await supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', now.toISOString());

    return new Response(JSON.stringify({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd > now ? now.toISOString() : periodEnd.toISOString(),
      jobsCreated: jobsCreated || 0,
      candidatesAdded: candidatesAdded || 0,
      activeMembers: activeMembers || 0,
      billableSeats,
      emailsSent: emailsSent || 0,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching billing period usage:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
