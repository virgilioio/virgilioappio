import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
const APOLLO_ENRICH_URL = 'https://api.apollo.io/api/v1/people/match';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface EnrichRequest {
  apollo_id: string;
  job_id?: string;
  stage_id?: string;
  user_id?: string;
}

// Helper to get tenant_id from organization
async function getTenantIdFromOrganization(organizationId: string): Promise<string> {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('tenant_id')
    .eq('id', organizationId)
    .single();
  
  if (error || !org) {
    throw new Error(`Organization not found: ${organizationId}`);
  }
  
  return org.tenant_id;
}

// Check credit availability
async function checkCollectCredit(
  tenantId: string
): Promise<{ available: boolean; remaining: number; usage: any }> {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  
  let { data: usage, error } = await supabase
    .from('sourcing_credits_usage')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('billing_cycle_start', currentMonth)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // No usage record exists, create one
    const { data: limits, error: limitsError } = await supabase
      .rpc('get_tenant_credit_limits', { p_tenant_id: tenantId })
      .single();
    
    if (limitsError) {
      console.error('Error getting tenant credit limits:', limitsError);
      throw limitsError;
    }
    
    const { data: newUsage, error: insertError } = await supabase
      .from('sourcing_credits_usage')
      .insert({
        tenant_id: tenantId,
        billing_cycle_start: currentMonth,
        search_credits_limit: limits.search_limit,
        collect_credits_limit: limits.collect_limit
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    usage = newUsage;
  } else if (error) {
    throw error;
  }
  
  const limit = usage.collect_credits_limit;
  const used = usage.collect_credits_used || 0;
  
  return {
    available: used < limit,
    remaining: limit - used,
    usage
  };
}

// Increment collect credit usage
async function incrementCollectCredit(tenantId: string): Promise<void> {
  const now = new Date();
  const billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const { error } = await supabase.rpc('increment_sourcing_usage', {
    p_tenant_id: tenantId,
    p_billing_cycle_start: billingCycleStart,
    p_credit_type: 'collect'
  });
  
  if (error) {
    console.error('Failed to increment collect credit usage:', error);
    throw error;
  }
  
  console.log(`Successfully incremented collect credit for tenant ${tenantId}`);
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { apollo_id, job_id, stage_id, user_id }: EnrichRequest = await req.json();

    console.log('🚀 Apollo Enrich Request:', { apollo_id, job_id });

    if (!apollo_id) {
      throw new Error('apollo_id is required');
    }

    // Validate API key
    if (!APOLLO_API_KEY) {
      throw new Error('APOLLO_API_KEY not configured');
    }

    // Get organization and tenant from job if provided, otherwise from user
    let organizationId: string;
    let tenantId: string;
    
    if (job_id) {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('organization_id, tenant_id')
        .eq('id', job_id)
        .single();
      
      if (jobError || !job) {
        throw new Error('Job not found');
      }
      
      organizationId = job.organization_id;
      tenantId = job.tenant_id;
    } else if (user_id) {
      // Get user's default organization
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('organization_id, tenant_id')
        .eq('user_id', user_id)
        .eq('user_status', 'active')
        .single();
      
      if (memberError || !member) {
        throw new Error('User membership not found');
      }
      
      organizationId = member.organization_id;
      tenantId = member.tenant_id;
    } else {
      throw new Error('job_id or user_id required');
    }

    // Check if candidate already exists by apollo_id
    const { data: existingCandidate } = await supabase
      .from('candidates')
      .select('id')
      .eq('apollo_id', apollo_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existingCandidate) {
      console.log('✅ Candidate already collected:', existingCandidate.id);
      
      // If job_id provided, add to job pipeline
      if (job_id) {
        // Check if association exists
        const { data: existingAssoc } = await supabase
          .from('job_candidate_associations')
          .select('id')
          .eq('candidate_id', existingCandidate.id)
          .eq('job_id', job_id)
          .maybeSingle();
        
        if (!existingAssoc) {
          // Determine stage
          let targetStageId = stage_id;
          if (!targetStageId) {
            const { data: firstStage } = await supabase
              .from('job_hiring_stages')
              .select('id')
              .eq('job_id', job_id)
              .order('position', { ascending: true })
              .limit(1)
              .single();
            
            targetStageId = firstStage?.id;
          }
          
          await supabase
            .from('job_candidate_associations')
            .insert({
              candidate_id: existingCandidate.id,
              job_id: job_id,
              current_stage_id: targetStageId,
              status: 'active',
              added_by: user_id
            });
        }
      }
      
      return new Response(JSON.stringify({
        candidate_id: existingCandidate.id,
        already_collected: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Check credit availability
    const creditCheck = await checkCollectCredit(tenantId);
    
    if (!creditCheck.available) {
      console.warn('❌ Monthly collect credit limit reached');
      return new Response(JSON.stringify({
        error: 'Monthly credit limit reached',
        error_code: 'CREDITS_EXHAUSTED',
        credits_remaining: 0
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    console.log(`💳 Credits available: ${creditCheck.remaining} collect credits remaining`);

    // Call Apollo API to enrich profile
    const apolloResponse = await fetch(APOLLO_ENRICH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY
      },
      body: JSON.stringify({ id: apollo_id })
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error('❌ Apollo API Error:', apolloResponse.status, errorText);
      throw new Error(`Apollo API error: ${apolloResponse.status}`);
    }

    const apolloData = await apolloResponse.json();
    const person = apolloData.person;
    
    if (!person) {
      throw new Error('No person data returned from Apollo');
    }

    console.log('✅ Apollo enrichment successful:', person.name);

    // Increment credit usage
    await incrementCollectCredit(tenantId);

    // Build location string
    const location = [person.city, person.state, person.country]
      .filter(Boolean)
      .join(', ');

    // Extract phone number
    const phone = person.phone_numbers?.[0]?.sanitized_number || 
                  person.phone_numbers?.[0]?.raw_number || null;

    // Create candidate record
    const { data: newCandidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({
        apollo_id: apollo_id,
        candidate_name: person.name || `${person.first_name} ${person.last_name}`.trim(),
        email: person.email,
        email_status: person.email_status,
        phone: phone,
        linkedin_url: person.linkedin_url,
        role_current: person.title,
        company_current: person.organization_name,
        location_city: person.city,
        location_state: person.state,
        location_country: person.country,
        bio: person.headline,
        source: 'apollo',
        organization_id: organizationId,
        tenant_id: tenantId,
        created_by: user_id,
        apollo_collected_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (candidateError) {
      console.error('Failed to create candidate:', candidateError);
      throw candidateError;
    }

    console.log('✅ Candidate created:', newCandidate.id);

    // Store work experience if available
    if (person.employment_history && person.employment_history.length > 0) {
      const experienceRecords = person.employment_history.map((exp: any) => ({
        candidate_id: newCandidate.id,
        company_name: exp.organization_name || 'Unknown Company',
        job_title: exp.title || 'Unknown Title',
        start_date: exp.start_date ? new Date(exp.start_date).toISOString().split('T')[0] : null,
        end_date: exp.end_date ? new Date(exp.end_date).toISOString().split('T')[0] : null,
        is_current: exp.current || false,
        description: exp.description
      }));

      const { error: expError } = await supabase
        .from('candidate_work_experience')
        .insert(experienceRecords);

      if (expError) {
        console.warn('Failed to store work experience:', expError);
      }
    }

    // If job_id provided, add to job pipeline
    if (job_id) {
      let targetStageId = stage_id;
      
      if (!targetStageId) {
        const { data: firstStage } = await supabase
          .from('job_hiring_stages')
          .select('id')
          .eq('job_id', job_id)
          .order('position', { ascending: true })
          .limit(1)
          .single();
        
        targetStageId = firstStage?.id;
      }
      
      const { error: assocError } = await supabase
        .from('job_candidate_associations')
        .insert({
          candidate_id: newCandidate.id,
          job_id: job_id,
          current_stage_id: targetStageId,
          status: 'active',
          added_by: user_id
        });

      if (assocError) {
        console.warn('Failed to add to job pipeline:', assocError);
      }
    }

    return new Response(JSON.stringify({
      candidate_id: newCandidate.id,
      already_collected: false,
      credits_remaining: creditCheck.remaining - 1
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error) {
    console.error('❌ Apollo enrich error:', error);
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
