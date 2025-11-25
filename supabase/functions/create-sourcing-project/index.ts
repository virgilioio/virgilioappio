import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handlePreflight, corsHeadersFor } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface CreateSourcingProjectRequest {
  name: string;
  description: string;
  job_id?: string;  // Now optional
  organization_id?: string;  // Added for standalone projects
  is_public?: boolean;
  conversationId?: string;  // Optional: link to existing AI conversation
  search_criteria: {
    skills: string[];
    locations?: string[];  // Changed to array
    title_keywords?: string[];
    salary_min?: number;
    salary_max?: number;
    currency?: string;
  };
}

interface CreateSourcingProjectResponse {
  id: string;
  created_at: string;
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
    const body: CreateSourcingProjectRequest = await req.json();
    const { name, description, job_id, organization_id, is_public, conversationId, search_criteria } = body;

    // Validate required fields
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Either job_id OR organization_id must be provided
    if (!job_id && !organization_id) {
      return new Response(
        JSON.stringify({ error: 'Either job_id or organization_id must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!search_criteria || !search_criteria.skills || search_criteria.skills.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: search_criteria.skills' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetOrganizationId: string;

    if (job_id) {
      // Scenario 1: Linked to existing job
      console.log(`📝 Creating sourcing project for job: ${job_id}`);
      
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id, organization_id, title')
        .eq('id', job_id)
        .single();

      if (jobError || !job) {
        console.error('❌ Job not found:', jobError);
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetOrganizationId = job.organization_id;
      console.log(`🏢 Organization from job: ${targetOrganizationId}`);
    } else {
      // Scenario 2: Standalone sourcing project
      console.log(`📝 Creating standalone sourcing project for organization: ${organization_id}`);
      targetOrganizationId = organization_id!;
      console.log(`🏢 Organization: ${targetOrganizationId}`);
    }

    // Insert sourcing project
    // RLS policies will automatically enforce:
    // - User has recruiter+ role in organization
    // - created_by matches auth.uid()
    const { data: project, error: insertError } = await supabase
      .from('sourcing_projects')
      .insert({
        name,
        description,
        job_id: job_id || null,  // Can be null now
        organization_id: targetOrganizationId,
        created_by: userId,
        search_criteria: search_criteria,
        enabled_sources: ['internal'],
        status: 'active',
        is_public: is_public ?? false
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('❌ Failed to create sourcing project:', insertError);
      
      // Check if it's a permission error
      if (insertError.code === '42501' || insertError.message?.includes('policy')) {
        return new Response(
          JSON.stringify({ error: 'Recruiter role required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to create project: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Project created: ${project.id}`);

    // Log activity for sourcing project creation
    const { error: activityError } = await supabase.rpc('log_activity', {
      p_user_id: userId,
      p_organization_id: targetOrganizationId,
      p_activity_type: 'sourcing_project_created',
      p_title: `Sourcing project created: ${name}`,
      p_description: job_id 
        ? `Created sourcing project for job` 
        : `Created standalone sourcing project`,
      p_metadata: {
        project_id: project.id,
        project_name: name,
        job_id: job_id || null,
        skills: search_criteria.skills,
        is_public: is_public ?? false
      },
      p_entity_type: 'sourcing_project',
      p_entity_id: project.id
    });

    if (activityError) {
      console.error('⚠️ Failed to log sourcing project creation activity:', activityError);
      // Don't fail the operation, just log the error
    }

    // Link conversation to project if conversationId provided
    if (conversationId) {
      console.log(`🔗 Linking conversation ${conversationId} to project ${project.id}`);
      const { error: convUpdateError } = await supabase
        .from('ai_conversations')
        .update({
          sourcing_project_id: project.id,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (convUpdateError) {
        console.error('⚠️ Failed to link conversation to project:', convUpdateError);
        // Don't fail the whole operation, just log it
      } else {
        console.log(`✅ Conversation linked successfully`);
      }
    }

    const response: CreateSourcingProjectResponse = {
      id: project.id,
      created_at: project.created_at
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in create-sourcing-project function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
