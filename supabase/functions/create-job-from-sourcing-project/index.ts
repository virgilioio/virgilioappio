import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handlePreflight, corsHeadersFor } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface CreateJobFromProjectRequest {
  sourcing_project_id: string;
  organization_id: string;  // Target Job Folder
}

interface CreateJobFromProjectResponse {
  job_id: string;
  job_title: string;
  message: string;
}

serve(async (req) => {
  const origin = req.headers.get('Origin') ?? req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);

  // Handle CORS preflight
  const preflightResponse = handlePreflight(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  try {
    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user ID from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`👤 User authenticated: ${userId}`);

    // Parse request body
    const body: CreateJobFromProjectRequest = await req.json();
    const { sourcing_project_id, organization_id } = body;

    // Validate required fields
    if (!sourcing_project_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sourcing_project_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: organization_id (target Job Folder)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the sourcing project with job_spec_data
    console.log(`📝 Fetching sourcing project: ${sourcing_project_id}`);
    const { data: project, error: projectError } = await supabase
      .from('sourcing_projects')
      .select('id, name, job_spec_data, job_id, organization_id')
      .eq('id', sourcing_project_id)
      .single();

    if (projectError || !project) {
      console.error('❌ Sourcing project not found:', projectError);
      return new Response(
        JSON.stringify({ error: 'Sourcing project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if job_spec_data exists
    if (!project.job_spec_data) {
      return new Response(
        JSON.stringify({ error: 'This sourcing project does not have job specification data. Only projects created via AI can be converted to jobs.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if project already has a linked job
    if (project.job_id) {
      return new Response(
        JSON.stringify({ error: 'This sourcing project is already linked to a job' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobSpec = project.job_spec_data as any;
    console.log(`📋 Creating job from spec: ${jobSpec.job_title}`);

    // Get tenant_id from target organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('tenant_id')
      .eq('id', organization_id)
      .single();

    if (orgError || !orgData?.tenant_id) {
      console.error('❌ Organization not found:', orgError);
      return new Response(
        JSON.stringify({ error: 'Target organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the job from job_spec_data
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        title: jobSpec.job_title,
        description: jobSpec.job_description || null,
        department: jobSpec.department || null,
        location: jobSpec.location || null,
        salary_min: jobSpec.salary_range?.min || null,
        salary_max: jobSpec.salary_range?.max || null,
        currency: jobSpec.salary_range?.currency || 'USD',
        skills: jobSpec.skills || [],
        organization_id: organization_id,
        tenant_id: orgData.tenant_id,
        created_by: userId,
        status: 'draft'  // Start as draft so user can review
      })
      .select('id, title')
      .single();

    if (jobError) {
      console.error('❌ Failed to create job:', jobError);
      return new Response(
        JSON.stringify({ error: `Failed to create job: ${jobError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Job created: ${job.id}`);

    // Link the sourcing project to the new job
    const { error: updateError } = await supabase
      .from('sourcing_projects')
      .update({ 
        job_id: job.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourcing_project_id);

    if (updateError) {
      console.warn('⚠️ Failed to link sourcing project to job:', updateError);
      // Don't fail the operation - the job is created successfully
    } else {
      console.log(`🔗 Sourcing project linked to job`);
    }

    // Log activity
    const { error: activityError } = await supabase.rpc('log_activity', {
      p_user_id: userId,
      p_organization_id: organization_id,
      p_activity_type: 'job_created',
      p_title: `Job created from sourcing project: ${job.title}`,
      p_description: `Created job "${job.title}" from sourcing project "${project.name}"`,
      p_metadata: {
        job_id: job.id,
        job_title: job.title,
        sourcing_project_id: project.id,
        sourcing_project_name: project.name
      },
      p_entity_type: 'job',
      p_entity_id: job.id
    });

    if (activityError) {
      console.warn('⚠️ Failed to log activity:', activityError);
    }

    const response: CreateJobFromProjectResponse = {
      job_id: job.id,
      job_title: job.title,
      message: `Job "${job.title}" created successfully from sourcing project`
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in create-job-from-sourcing-project function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
