import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";

const CORESIGNAL_API_KEY = Deno.env.get('CORESIGNAL_API_KEY');
const CORESIGNAL_API_URL = 'https://api.coresignal.com/v2/employee_base/search/filter/preview';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SearchCriteria {
  skills: string[];
  location?: string;
  salary_min?: number;
  salary_max?: number;
  experience_years?: { min?: number; max?: number };
}

interface SearchRequest {
  project_id?: string;
  criteria: SearchCriteria;
  limit?: number;
  organization_id?: string;
}

interface CoreSignalCandidate {
  coresignal_id: string;
  full_name: string;
  headline: string;
  location: string;
  country: string;
  profile_url: string;
  current_company?: string;
  current_title?: string;
  experience_count: number;
  _score: number;
}

// Build CoreSignal Filter API query from criteria
function buildCoresignalFilterQuery(criteria: SearchCriteria): any {
  const query: any = {};
  
  // Skills: Use OR logic with wildcards for broader matching
  if (criteria.skills && criteria.skills.length > 0) {
    query.skill = criteria.skills.map(s => `*${s}*`).join(' OR ');
  }
  
  // Location: Fuzzy match on country
  if (criteria.location) {
    query.country = `*${criteria.location}*`;
  }
  
  // Active experience only
  query.active_experience = true;
  
  return query;
}

// Check credit availability
async function checkCreditAvailability(
  organizationId: string, 
  type: 'search' | 'collect'
): Promise<{ available: boolean; remaining: number; usage: any }> {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  
  // Get or create usage record for current month
  let { data: usage, error } = await supabase
    .from('coresignal_usage')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('month', currentMonth)
    .single();
  
  // If no record exists, create one
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
    usage
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
  
  const { error } = await supabase.rpc('increment', {
    table_name: 'coresignal_usage',
    id_column: 'organization_id',
    id_value: organizationId,
    counter_column: updateField,
    month_value: currentMonth
  });
  
  // Fallback if RPC doesn't exist - use direct update
  if (error) {
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
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { project_id, criteria, limit = 100, organization_id }: SearchRequest = await req.json();

    console.log('🔍 CoreSignal Search Request:', { project_id, criteria, limit });

    // Determine organization ID
    let orgId = organization_id;
    
    if (!orgId && project_id) {
      // Get organization from project
      const { data: project, error: projectError } = await supabase
        .from('sourcing_projects')
        .select('organization_id')
        .eq('id', project_id)
        .single();
      
      if (projectError) {
        throw new Error('Project not found');
      }
      
      orgId = project.organization_id;
    }
    
    if (!orgId) {
      throw new Error('Organization ID required');
    }

    // Check cache if project_id provided
    let cached = false;
    if (project_id) {
      const { data: project } = await supabase
        .from('sourcing_projects')
        .select('coresignal_cache_expires_at, coresignal_candidate_count')
        .eq('id', project_id)
        .single();
      
      if (project?.coresignal_cache_expires_at) {
        const cacheExpiry = new Date(project.coresignal_cache_expires_at);
        if (cacheExpiry > new Date()) {
          console.log('✅ Using cached CoreSignal results');
          cached = true;
          
          // Return cached count (actual candidates stored separately)
          return new Response(JSON.stringify({
            candidates: [], // Candidates fetched separately
            total_count: project.coresignal_candidate_count || 0,
            credits_used: 0,
            credits_remaining: 0,
            cached: true
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...cors },
          });
        }
      }
    }

    // Check credit availability
    const creditCheck = await checkCreditAvailability(orgId, 'search');
    
    if (!creditCheck.available) {
      return new Response(JSON.stringify({
        error: 'Monthly credit limit reached',
        error_code: 'CREDITS_EXHAUSTED',
        credits_remaining: 0,
        next_reset: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Build CoreSignal query
    const queryParams = buildCoresignalFilterQuery(criteria);
    
    console.log('📡 Calling CoreSignal API with query:', queryParams);

    // Call CoreSignal API
    const coresignalResponse = await fetch(`${CORESIGNAL_API_URL}?page=1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CORESIGNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryParams),
    });

    if (!coresignalResponse.ok) {
      const errorText = await coresignalResponse.text();
      console.error('CoreSignal API error:', errorText);
      throw new Error(`CoreSignal API error: ${coresignalResponse.status}`);
    }

    const coresignalData = await coresignalResponse.json();
    
    console.log('✅ CoreSignal API response:', {
      total: coresignalData.total || 0,
      returned: coresignalData.results?.length || 0
    });

    // Parse preview results
    const candidates: CoreSignalCandidate[] = (coresignalData.results || []).map((result: any) => ({
      coresignal_id: result.id,
      full_name: result.full_name || 'Unknown',
      headline: result.headline || '',
      location: result.location || '',
      country: result.country || '',
      profile_url: result.profile_url || result.linkedin_url || '',
      current_company: result.current_company?.name || result.current_experience?.company,
      current_title: result.current_experience?.title || result.current_position,
      experience_count: result.experience?.length || 0,
      _score: result._score || 0
    })).slice(0, limit);

    // Increment credit usage
    await incrementCreditUsage(orgId, 'search');
    
    // Update project cache metadata if project_id provided
    if (project_id) {
      const cacheExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      await supabase
        .from('sourcing_projects')
        .update({
          coresignal_candidate_count: coresignalData.total || 0,
          coresignal_last_searched_at: new Date().toISOString(),
          coresignal_cache_expires_at: cacheExpiry.toISOString()
        })
        .eq('id', project_id);
    }

    const response = {
      candidates,
      total_count: coresignalData.total || 0,
      credits_used: 1,
      credits_remaining: creditCheck.remaining - 1,
      cached: false
    };

    console.log(`✅ CoreSignal search complete: ${candidates.length} candidates (1 credit used, ${creditCheck.remaining - 1} remaining)`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error) {
    console.error('❌ Error in search-coresignal-candidates function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to search CoreSignal candidates'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
