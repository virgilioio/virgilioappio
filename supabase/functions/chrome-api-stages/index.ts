import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handlePreflight, corsHeadersFor } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  const origin = req.headers.get('Origin') ?? req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);

  // Handle CORS preflight
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const jobId = url.searchParams.get('job_id');

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: job_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`👤 Chrome API /stages - User: ${user.id}, Job: ${jobId}`);

    // Get user's tenant_id from members table
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single();

    if (memberError || !member?.tenant_id) {
      console.error('❌ Member/tenant not found:', memberError);
      return new Response(
        JSON.stringify({ error: 'User not associated with any tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = member.tenant_id;

    // Verify the job belongs to this tenant
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, tenant_id, organization_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('❌ Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (job.tenant_id !== tenantId) {
      console.error('❌ Job belongs to different tenant');
      return new Response(
        JSON.stringify({ error: 'Access denied: job belongs to a different tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get hiring stages for this job (joined with job_stages for stage details)
    const { data: hiringStages, error: stagesError } = await supabase
      .from('job_hiring_stages')
      .select(`
        id,
        position,
        custom_stage_name,
        job_stages!job_hiring_stages_stage_id_fkey (
          stage_name,
          stage_type
        )
      `)
      .eq('job_id', jobId)
      .order('position');

    if (stagesError) {
      console.error('❌ Error fetching stages:', stagesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch stages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform the response to use custom_stage_name if available
    const stages = (hiringStages ?? []).map(hs => {
      const jobStage = hs.job_stages as { stage_name: string; stage_type: string } | null;
      return {
        id: hs.id,  // This is job_hiring_stages.id - what we need for current_stage_id
        stage_name: hs.custom_stage_name || jobStage?.stage_name || 'Unknown',
        stage_type: jobStage?.stage_type || 'unknown',
        position: hs.position
      };
    });

    console.log(`✅ Found ${stages.length} stages for job`);

    return new Response(JSON.stringify({ stages }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in chrome-api-stages:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
