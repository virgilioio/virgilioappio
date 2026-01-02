import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handlePreflight, corsHeadersFor } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface CreateCandidateRequest {
  organization_id: string;
  job_id: string;
  stage_id: string;  // job_hiring_stages.id
  candidate_name: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  company_current?: string;
  role_current?: string;
  location_city?: string;
  location_country?: string;
  profile_summary?: string;
  skills?: string[];
  notes?: string;
}

serve(async (req) => {
  const origin = req.headers.get('Origin') ?? req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);

  // Handle CORS preflight
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  // Only allow POST
  if (req.method !== 'POST') {
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

    const userId = user.id;

    // Parse request body
    const body: CreateCandidateRequest = await req.json();
    const {
      organization_id,
      job_id,
      stage_id,
      candidate_name,
      email,
      phone,
      linkedin_url,
      company_current,
      role_current,
      location_city,
      location_country,
      profile_summary,
      skills,
      notes
    } = body;

    // Validate required fields
    if (!organization_id || !job_id || !stage_id || !candidate_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organization_id, job_id, stage_id, candidate_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`👤 Chrome API /candidates - User: ${userId}, Creating candidate: ${candidate_name}`);

    // Get user's tenant_id from members table
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('tenant_id')
      .eq('user_id', userId)
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

    // Verify organization belongs to tenant
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, tenant_id')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      console.error('❌ Organization not found:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (org.tenant_id !== tenantId) {
      console.error('❌ Organization belongs to different tenant');
      return new Response(
        JSON.stringify({ error: 'Access denied: organization belongs to a different tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify job belongs to tenant and organization
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, tenant_id, organization_id')
      .eq('id', job_id)
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

    if (job.organization_id !== organization_id) {
      console.error('❌ Job does not belong to specified organization');
      return new Response(
        JSON.stringify({ error: 'Job does not belong to the specified organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify stage belongs to job
    const { data: stage, error: stageError } = await supabase
      .from('job_hiring_stages')
      .select('id, job_id')
      .eq('id', stage_id)
      .single();

    if (stageError || !stage) {
      console.error('❌ Stage not found:', stageError);
      return new Response(
        JSON.stringify({ error: 'Stage not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (stage.job_id !== job_id) {
      console.error('❌ Stage does not belong to specified job');
      return new Response(
        JSON.stringify({ error: 'Stage does not belong to the specified job' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate candidate by email or linkedin_url within the organization
    let existingCandidate = null;
    let wasDuplicate = false;

    if (email) {
      const { data: byEmail } = await supabase
        .from('candidates')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('email', email)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (byEmail) {
        existingCandidate = byEmail;
        wasDuplicate = true;
        console.log(`🔍 Found duplicate by email: ${email}`);
      }
    }

    if (!existingCandidate && linkedin_url) {
      const { data: byLinkedIn } = await supabase
        .from('candidates')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('linkedin_url', linkedin_url)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (byLinkedIn) {
        existingCandidate = byLinkedIn;
        wasDuplicate = true;
        console.log(`🔍 Found duplicate by LinkedIn: ${linkedin_url}`);
      }
    }

    let candidateId: string;
    let existingJobAssociations: Array<{
      association_id: string;
      job_id: string;
      job_title: string;
      stage_id: string | null;
      stage_name: string;
      candidate_url: string;
    }> | null = null;

    if (existingCandidate) {
      // Use existing candidate
      candidateId = existingCandidate.id;
      console.log(`📋 Using existing candidate: ${candidateId}`);

      // Fetch existing job associations for this candidate
      const { data: associations, error: assocFetchError } = await supabase
        .from('job_candidate_associations')
        .select(`
          id,
          status,
          current_stage_id,
          job_id,
          jobs!inner (
            id,
            title
          ),
          job_hiring_stages (
            id,
            custom_stage_name,
            job_stages (
              stage_name
            )
          )
        `)
        .eq('candidate_id', candidateId)
        .in('status', ['active', 'offer', 'hired']);

      if (assocFetchError) {
        console.error('⚠️ Failed to fetch existing associations:', assocFetchError);
      } else if (associations && associations.length > 0) {
        existingJobAssociations = associations.map((assoc: any) => ({
          association_id: assoc.id,
          job_id: assoc.job_id,
          job_title: assoc.jobs?.title || 'Unknown Job',
          stage_id: assoc.current_stage_id,
          stage_name: assoc.job_hiring_stages?.custom_stage_name 
            || assoc.job_hiring_stages?.job_stages?.stage_name 
            || 'Unknown Stage',
          candidate_url: `/jobs/${assoc.job_id}/candidates/${candidateId}`
        }));
        console.log(`📋 Found ${existingJobAssociations.length} existing job associations`);
      }
    } else {
      // Create new candidate
      const { data: newCandidate, error: createError } = await supabase
        .from('candidates')
        .insert({
          candidate_name,
          email: email || null,
          phone: phone || null,
          linkedin_url: linkedin_url || null,
          company_current: company_current || null,
          role_current: role_current || null,
          location_city: location_city || null,
          location_country: location_country || null,
          profile_summary: profile_summary || null,
          skills: skills || null,
          source: 'linkedin_extension',
          organization_id,
          tenant_id: tenantId,
          created_by: userId,
          status: 'available'
        })
        .select('id')
        .single();

      if (createError || !newCandidate) {
        console.error('❌ Failed to create candidate:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create candidate' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      candidateId = newCandidate.id;
      console.log(`✨ Created new candidate: ${candidateId}`);
    }

    // Check if association already exists
    const { data: existingAssoc } = await supabase
      .from('job_candidate_associations')
      .select('id')
      .eq('job_id', job_id)
      .eq('candidate_id', candidateId)
      .maybeSingle();

    let associationId: string;
    let action: string;

    if (existingAssoc) {
      // Update existing association's stage
      const { error: updateError } = await supabase
        .from('job_candidate_associations')
        .update({
          current_stage_id: stage_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAssoc.id);

      if (updateError) {
        console.error('❌ Failed to update association:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update job association' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      associationId = existingAssoc.id;
      action = 'updated';
      console.log(`🔄 Updated existing association: ${associationId}`);
    } else {
      // Create new association
      const { data: newAssoc, error: assocError } = await supabase
        .from('job_candidate_associations')
        .insert({
          job_id,
          candidate_id: candidateId,
          current_stage_id: stage_id,
          status: 'active',
          added_by: userId,
          notes: notes || null,
          entered_stage_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (assocError || !newAssoc) {
        console.error('❌ Failed to create association:', assocError);
        return new Response(
          JSON.stringify({ error: 'Failed to create job association' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      associationId = newAssoc.id;
      action = wasDuplicate ? 'attached' : 'created';
      console.log(`✅ Created new association: ${associationId}`);
    }

    // Build response
    const response: Record<string, any> = {
      candidate_id: candidateId,
      association_id: associationId,
      was_duplicate: wasDuplicate,
      action  // 'created' | 'attached' | 'updated'
    };

    // Include existing jobs when duplicate is found
    if (wasDuplicate && existingJobAssociations && existingJobAssociations.length > 0) {
      response.existing_jobs = existingJobAssociations;
    }

    console.log(`✅ Chrome API /candidates - Success: ${JSON.stringify(response)}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in chrome-api-candidates:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
