import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const CORESIGNAL_API_KEY = Deno.env.get('CORESIGNAL_API_KEY');
const CORESIGNAL_COLLECT_URL = 'https://api.coresignal.com/cdapi/v2/employee_base/collect';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface CollectRequest {
  coresignal_id: string;
  project_id?: string;
  job_id?: string;
  organization_id?: string;
  user_id?: string;
}

// Check credit availability with enhanced error details
async function checkCreditAvailability(
  organizationId: string, 
  type: 'search' | 'collect'
): Promise<{ available: boolean; remaining: number; usage: any; nextReset: string }> {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  
  // Calculate next reset date (first day of next month)
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextReset = nextMonth.toISOString().slice(0, 10);
  
  let { data: usage, error } = await supabase
    .from('coresignal_usage')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('month', currentMonth)
    .single();
  
  if (error && error.code === 'PGRST116') {
    const { data: newUsage, error: insertError } = await supabase
      .from('coresignal_usage')
      .insert({
        organization_id: organizationId,
        month: currentMonth,
        search_credits_limit: 500,
        collect_credits_limit: 250
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    usage = newUsage;
  } else if (error) {
    throw error;
  }
  
  const limit = type === 'search' ? usage.search_credits_limit : usage.collect_credits_limit;
  const used = type === 'search' ? usage.search_credits_used : usage.collect_credits_used;
  
  return {
    available: used < limit,
    remaining: limit - used,
    usage,
    nextReset
  };
}

// Increment credit usage
async function incrementCreditUsage(
  organizationId: string,
  type: 'search' | 'collect'
): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  const updateField = type === 'search' ? 'search_credits_used' : 'collect_credits_used';
  const timestampField = type === 'search' ? 'last_search_at' : 'last_collect_at';
  
  await supabase
    .from('coresignal_usage')
    .update({
      [updateField]: supabase.rpc('increment_value', { current: 1 }),
      [timestampField]: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', organizationId)
    .eq('month', currentMonth);
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { coresignal_id, project_id, job_id, organization_id, user_id }: CollectRequest = await req.json();

    console.log('📥 CoreSignal Collect Request:', { coresignal_id, project_id, job_id, user_id });

    // Determine organization ID
    let orgId = organization_id;
    
    if (!orgId && project_id) {
      const { data: project, error: projectError } = await supabase
        .from('sourcing_projects')
        .select('organization_id, job_id')
        .eq('id', project_id)
        .single();
      
      if (projectError) throw new Error('Project not found');
      orgId = project.organization_id;
    } else if (!orgId && job_id) {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('organization_id')
        .eq('id', job_id)
        .single();
      
      if (jobError) throw new Error('Job not found');
      orgId = job.organization_id;
    }
    
    if (!orgId) {
      throw new Error('Organization ID required');
    }

    // Check if profile already collected
    const { data: existing } = await supabase
      .from('candidates')
      .select('id')
      .eq('coresignal_profile_id', coresignal_id)
      .eq('organization_id', orgId)
      .single();
    
    if (existing) {
      console.log('✅ Profile already collected:', existing.id);
      
      // Create association if job_id provided
      if (job_id) {
        await supabase
          .from('job_candidate_associations')
          .insert({
            job_id,
            candidate_id: existing.id
          })
          .onConflict('job_id,candidate_id')
          .ignore();
      }
      
      return new Response(JSON.stringify({
        candidate_id: existing.id,
        collect_credit_used: false,
        credits_remaining: 0,
        already_collected: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Check collect credit availability BEFORE making API call
    const creditCheck = await checkCreditAvailability(orgId, 'collect');
    
    if (!creditCheck.available) {
      console.warn('❌ Monthly collect credit limit reached');
      return new Response(JSON.stringify({
        error: 'Monthly credit limit reached',
        error_code: 'CREDITS_EXHAUSTED',
        credits_remaining: 0,
        credits_limit: creditCheck.usage.collect_credits_limit,
        credits_used: creditCheck.usage.collect_credits_used,
        next_reset: creditCheck.nextReset
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    console.log(`💳 Credits available: ${creditCheck.remaining} collect credits remaining`);

    console.log('📡 Calling CoreSignal Collect API for ID:', coresignal_id);

    // Call CoreSignal Collect API
    const coresignalResponse = await fetch(`${CORESIGNAL_COLLECT_URL}/${coresignal_id}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apikey': CORESIGNAL_API_KEY,
      },
    });

    if (!coresignalResponse.ok) {
      const errorText = await coresignalResponse.text();
      console.error('CoreSignal Collect API error:', errorText);
      throw new Error(`CoreSignal Collect API error: ${coresignalResponse.status}`);
    }

    const profile = await coresignalResponse.json();
    
    console.log('✅ CoreSignal profile collected:', profile.full_name);

    // Extract and structure the data
    const candidateData: any = {
      organization_id: orgId,
      created_by: user_id || null,
      candidate_name: profile.full_name || 'Unknown',
      email: profile.emails?.[0] || null,
      phone: profile.phones?.[0] || null,
      linkedin_url: profile.profile_url || profile.linkedin_url || null,
      location_city: profile.location_city || null,
      location_country: profile.location_country || profile.country || null,
      profile_summary: profile.headline || profile.summary || null,
      skills: profile.skills?.map((s: any) => s.name || s) || [],
      source: 'coresignal',
      coresignal_profile_id: coresignal_id,
      coresignal_search_score: profile._score || 0,
      coresignal_collected_at: new Date().toISOString(),
      coresignal_headline: profile.headline || null,
      coresignal_connections_count: profile.connections_count || null,
      years_experience: profile.experience?.length || null,
      company_current: profile.current_company?.name || profile.current_experience?.company || null,
      role_current: profile.current_experience?.title || profile.current_position || null,
      enrichment_status: 'completed',
      enriched_at: new Date().toISOString()
    };

    // Insert candidate
    const { data: candidate, error: insertError } = await supabase
      .from('candidates')
      .insert(candidateData)
      .select('id')
      .single();

    if (insertError) {
      console.error('❌ Failed to insert candidate:', insertError);
      throw insertError;
    }

    console.log('✅ Candidate inserted:', candidate.id);

    // Insert work experience
    if (profile.experience && profile.experience.length > 0) {
      const experiences = profile.experience.slice(0, 10).map((exp: any) => ({
        candidate_id: candidate.id,
        job_title: exp.title || '',
        company_name: exp.company || '',
        description: exp.description || null,
        start_date: exp.start_date || null,
        end_date: exp.end_date || null,
        is_current: exp.is_current || false,
        location: exp.location || null
      }));

      await supabase
        .from('candidate_work_experience')
        .insert(experiences);
    }

    // Insert education
    if (profile.education && profile.education.length > 0) {
      const education = profile.education.slice(0, 5).map((edu: any) => ({
        candidate_id: candidate.id,
        institution_name: edu.institution || '',
        degree_type: edu.degree || null,
        field_of_study: edu.field_of_study || null,
        start_date: edu.start_date || null,
        end_date: edu.end_date || null,
        description: edu.description || null
      }));

      await supabase
        .from('candidate_education')
        .insert(education);
    }

    // Create job association if job_id provided
    if (job_id) {
      await supabase
        .from('job_candidate_associations')
        .insert({
          job_id,
          candidate_id: candidate.id
        });
    }

    // Increment credit usage
    await incrementCreditUsage(orgId, 'collect');

    const response = {
      candidate_id: candidate.id,
      collect_credit_used: true,
      credits_remaining: creditCheck.remaining - 1
    };

    console.log(`✅ CoreSignal profile collected successfully (1 credit used, ${creditCheck.remaining - 1} remaining)`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error) {
    console.error('❌ Error in collect-coresignal-profile function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to collect CoreSignal profile'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
