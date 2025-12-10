import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
const APOLLO_API_URL = 'https://api.apollo.io/api/v1/mixed_people/search';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SearchCriteria {
  skills: string[];
  title_keywords?: string[];
  locations?: string[];
  salary_min?: number;
  salary_max?: number;
  experience_years?: { min?: number; max?: number };
  seniorities?: string[];
}

interface SearchRequest {
  project_id?: string;
  criteria: SearchCriteria;
  limit?: number;
  organization_id?: string;
}

interface ApolloCandidate {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  headline?: string;
  title?: string;
  linkedin_url?: string;
  email?: string;
  email_status?: string;
  phone_numbers?: Array<{ raw_number: string; sanitized_number: string; type: string }>;
  organization_name?: string;
  city?: string;
  state?: string;
  country?: string;
  seniority?: string;
  departments?: string[];
  employment_history?: Array<{
    organization_name: string;
    title: string;
    current: boolean;
  }>;
}

// Map seniority values to Apollo's expected format
const SENIORITY_MAPPING: Record<string, string> = {
  'junior': 'entry',
  'entry': 'entry',
  'mid': 'senior',
  'senior': 'senior',
  'manager': 'manager',
  'director': 'director',
  'vp': 'vp',
  'executive': 'c_suite',
  'c_suite': 'c_suite',
  'c-suite': 'c_suite'
};

// Parse location string to Apollo format
// Input formats: "City,State,Country" or "State,Country" or "Country"
function parseLocationForApollo(locationValue: string): { city?: string; state?: string; country?: string } {
  const parts = locationValue.split(',').map(p => p.trim());
  
  if (parts.length === 3) {
    return { city: parts[0], state: parts[1], country: parts[2] };
  } else if (parts.length === 2) {
    return { state: parts[0], country: parts[1] };
  } else if (parts.length === 1) {
    return { country: parts[0] };
  }
  
  return {};
}

// Convert country codes to full names for Apollo
const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  'US': 'United States', 'CA': 'Canada', 'GB': 'United Kingdom', 'DE': 'Germany',
  'FR': 'France', 'ES': 'Spain', 'IT': 'Italy', 'NL': 'Netherlands', 'BE': 'Belgium',
  'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland', 'PL': 'Poland',
  'PT': 'Portugal', 'GR': 'Greece', 'AT': 'Austria', 'CH': 'Switzerland', 'IE': 'Ireland',
  'MX': 'Mexico', 'BR': 'Brazil', 'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia',
  'PE': 'Peru', 'VE': 'Venezuela', 'EC': 'Ecuador', 'GT': 'Guatemala', 'CR': 'Costa Rica',
  'PA': 'Panama', 'UY': 'Uruguay', 'BO': 'Bolivia', 'PY': 'Paraguay', 'HN': 'Honduras',
  'SV': 'El Salvador', 'NI': 'Nicaragua', 'DO': 'Dominican Republic', 'IN': 'India',
  'CN': 'China', 'JP': 'Japan', 'SG': 'Singapore', 'AU': 'Australia', 'NZ': 'New Zealand',
  'KR': 'South Korea', 'TH': 'Thailand', 'VN': 'Vietnam', 'PH': 'Philippines',
  'ID': 'Indonesia', 'MY': 'Malaysia', 'AE': 'United Arab Emirates', 'SA': 'Saudi Arabia',
  'EG': 'Egypt', 'ZA': 'South Africa', 'KE': 'Kenya', 'NG': 'Nigeria'
};

// Build Apollo API request body
function buildApolloRequestBody(criteria: SearchCriteria, page: number = 1, perPage: number = 50): Record<string, any> {
  const body: Record<string, any> = {
    page,
    per_page: perPage,
    contact_email_status: ['verified'], // Only get verified emails
  };

  // Title keywords → person_titles (CURRENT JOB TITLE - Apollo's key advantage!)
  if (criteria.title_keywords && criteria.title_keywords.length > 0) {
    body.person_titles = criteria.title_keywords.slice(0, 5);
    body.include_similar_titles = true; // Allow similar titles for broader results
    console.log(`🎯 Apollo title filter (CURRENT job): ${body.person_titles.join(', ')}`);
  }

  // Skills → q_keywords (general keyword search)
  if (criteria.skills && criteria.skills.length > 0) {
    body.q_keywords = criteria.skills.slice(0, 5).join(' OR ');
    console.log(`🔧 Apollo skills keyword: ${body.q_keywords}`);
  }

  // Locations → person_locations
  if (criteria.locations && criteria.locations.length > 0) {
    const apolloLocations: string[] = [];
    
    for (const loc of criteria.locations) {
      const parsed = parseLocationForApollo(loc);
      
      if (parsed.city && parsed.country) {
        const countryName = COUNTRY_CODE_TO_NAME[parsed.country] || parsed.country;
        apolloLocations.push(`${parsed.city}, ${countryName}`);
      } else if (parsed.state && parsed.country) {
        const countryName = COUNTRY_CODE_TO_NAME[parsed.country] || parsed.country;
        apolloLocations.push(`${parsed.state}, ${countryName}`);
      } else if (parsed.country) {
        const countryName = COUNTRY_CODE_TO_NAME[parsed.country] || parsed.country;
        apolloLocations.push(countryName);
      }
    }
    
    if (apolloLocations.length > 0) {
      body.person_locations = apolloLocations;
      console.log(`📍 Apollo locations: ${apolloLocations.join(', ')}`);
    }
  }

  // Seniority filter
  if (criteria.seniorities && criteria.seniorities.length > 0) {
    const apolloSeniorities = criteria.seniorities
      .map(s => SENIORITY_MAPPING[s.toLowerCase()] || s.toLowerCase())
      .filter(Boolean);
    
    if (apolloSeniorities.length > 0) {
      body.person_seniorities = apolloSeniorities;
      console.log(`📊 Apollo seniority: ${apolloSeniorities.join(', ')}`);
    }
  }

  return body;
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

// Check credit availability with tier-based limits
async function checkCreditAvailability(
  organizationId: string, 
  type: 'search' | 'collect'
): Promise<{ available: boolean; remaining: number; usage: any; nextReset: string }> {
  const tenant_id = await getTenantIdFromOrganization(organizationId);
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextReset = nextMonth.toISOString().slice(0, 10);
  
  let { data: usage, error } = await supabase
    .from('coresignal_usage')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('billing_cycle_start', currentMonth)
    .single();
  
  if (error && error.code === 'PGRST116') {
    const { data: limits, error: limitsError } = await supabase
      .rpc('get_tenant_credit_limits', { p_tenant_id: tenant_id })
      .single();
    
    if (limitsError) {
      console.error('Error getting tenant credit limits:', limitsError);
      throw limitsError;
    }
    
    const { data: newUsage, error: insertError } = await supabase
      .from('coresignal_usage')
      .insert({
        tenant_id: tenant_id,
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
  const tenant_id = await getTenantIdFromOrganization(organizationId);
  const now = new Date();
  const billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const { error } = await supabase.rpc('increment_coresignal_usage', {
    p_tenant_id: tenant_id,
    p_billing_cycle_start: billingCycleStart,
    p_credit_type: type
  });
  
  if (error) {
    console.error(`Failed to increment ${type} credit usage:`, error);
    throw error;
  }
  
  console.log(`Successfully incremented ${type} credit for tenant ${tenant_id}`);
}

// Map Apollo candidate to our format
function mapApolloCandidate(apolloCandidate: ApolloCandidate): any {
  const location = [
    apolloCandidate.city,
    apolloCandidate.state,
    apolloCandidate.country
  ].filter(Boolean).join(', ');

  // Extract primary phone number
  const phone = apolloCandidate.phone_numbers?.[0]?.sanitized_number || 
                apolloCandidate.phone_numbers?.[0]?.raw_number || null;

  return {
    apollo_id: apolloCandidate.id,
    full_name: apolloCandidate.name || `${apolloCandidate.first_name} ${apolloCandidate.last_name}`.trim(),
    headline: apolloCandidate.headline || apolloCandidate.title,
    location: location,
    country: apolloCandidate.country,
    profile_url: apolloCandidate.linkedin_url,
    current_company: apolloCandidate.organization_name,
    current_title: apolloCandidate.title,
    email: apolloCandidate.email,
    email_status: apolloCandidate.email_status,
    phone: phone,
    seniority: apolloCandidate.seniority,
    experience_count: apolloCandidate.employment_history?.length || 0,
    _score: 100 // Apollo doesn't provide a relevance score, use 100 as default
  };
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { project_id, criteria, limit = 100, organization_id }: SearchRequest = await req.json();

    console.log('🚀 Apollo Search Request:', { project_id, criteria, limit });

    // Validate API key
    if (!APOLLO_API_KEY) {
      throw new Error('APOLLO_API_KEY not configured');
    }

    // Determine organization ID
    let orgId = organization_id;
    
    if (!orgId && project_id) {
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
    if (project_id) {
      const { data: project } = await supabase
        .from('sourcing_projects')
        .select('coresignal_cache_expires_at, coresignal_candidate_count')
        .eq('id', project_id)
        .single();
      
      if (project?.coresignal_cache_expires_at) {
        const cacheExpiry = new Date(project.coresignal_cache_expires_at);
        if (cacheExpiry > new Date()) {
          console.log('✅ Using cached Apollo results');
          
          const { data: cachedCandidates } = await supabase
            .from('coresignal_preview_candidates')
            .select('*')
            .eq('sourcing_project_id', project_id);
          
          const candidates = (cachedCandidates || []).map(c => ({
            apollo_id: c.coresignal_id,
            full_name: c.full_name,
            headline: c.headline,
            location: c.location,
            country: c.country,
            profile_url: c.profile_url,
            current_company: c.current_company,
            current_title: c.current_title,
            experience_count: c.experience_count,
            _score: c.coresignal_score
          }));
          
          const creditCheck = await checkCreditAvailability(orgId, 'search');
          
          return new Response(JSON.stringify({
            candidates,
            total_count: project.coresignal_candidate_count || candidates.length,
            credits_used: 0,
            credits_remaining: creditCheck.remaining,
            cached: true,
            provider: 'apollo'
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
      console.warn('❌ Monthly search credit limit reached');
      return new Response(JSON.stringify({
        error: 'Monthly credit limit reached',
        error_code: 'CREDITS_EXHAUSTED',
        credits_remaining: 0,
        credits_limit: creditCheck.usage.search_credits_limit,
        credits_used: creditCheck.usage.search_credits_used,
        next_reset: creditCheck.nextReset
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    console.log(`💳 Credits available: ${creditCheck.remaining} search credits remaining`);

    // Build Apollo request
    const perPage = Math.min(limit, 100); // Apollo max is 100 per page
    const requestBody = buildApolloRequestBody(criteria, 1, perPage);

    console.log('📡 Apollo API Request:', JSON.stringify(requestBody, null, 2));

    // Call Apollo API
    const apolloResponse = await fetch(APOLLO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error('❌ Apollo API Error:', apolloResponse.status, errorText);
      throw new Error(`Apollo API error: ${apolloResponse.status} - ${errorText}`);
    }

    const apolloData = await apolloResponse.json();
    
    console.log(`✅ Apollo returned ${apolloData.people?.length || 0} candidates`);

    // Increment credit usage after successful API call
    await incrementCreditUsage(orgId, 'search');

    // Map Apollo candidates to our format
    const candidates = (apolloData.people || []).map(mapApolloCandidate);
    const totalCount = apolloData.pagination?.total_entries || candidates.length;

    // Store in cache if project_id provided
    if (project_id && candidates.length > 0) {
      // Clear old cache
      await supabase
        .from('coresignal_preview_candidates')
        .delete()
        .eq('sourcing_project_id', project_id);

      // Insert new candidates
      const candidatesToInsert = candidates.slice(0, 200).map((c: any) => ({
        sourcing_project_id: project_id,
        coresignal_id: c.apollo_id,
        full_name: c.full_name,
        headline: c.headline,
        location: c.location,
        country: c.country,
        profile_url: c.profile_url,
        current_company: c.current_company,
        current_title: c.current_title,
        experience_count: c.experience_count,
        coresignal_score: c._score
      }));

      const { error: insertError } = await supabase
        .from('coresignal_preview_candidates')
        .insert(candidatesToInsert);

      if (insertError) {
        console.warn('⚠️ Failed to cache candidates:', insertError);
      }

      // Update project cache metadata
      const cacheExpiry = new Date();
      cacheExpiry.setHours(cacheExpiry.getHours() + 24);

      await supabase
        .from('sourcing_projects')
        .update({
          coresignal_cache_expires_at: cacheExpiry.toISOString(),
          coresignal_candidate_count: totalCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', project_id);
    }

    // Get updated credit info
    const updatedCreditCheck = await checkCreditAvailability(orgId, 'search');

    return new Response(JSON.stringify({
      candidates,
      total_count: totalCount,
      credits_used: 1,
      credits_remaining: updatedCreditCheck.remaining,
      cached: false,
      provider: 'apollo'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error) {
    console.error('❌ Apollo search error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      provider: 'apollo'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
