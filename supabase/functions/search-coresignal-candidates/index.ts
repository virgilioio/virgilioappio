import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const CORESIGNAL_API_KEY = Deno.env.get('CORESIGNAL_API_KEY');
const CORESIGNAL_API_URL = 'https://api.coresignal.com/cdapi/v2/employee_base/search/filter/preview';

// Regional country mappings for CoreSignal location queries
const REGION_COUNTRY_MAPPING: Record<string, string[]> = {
  'LATAM': [
    'Mexico', 'Colombia', 'Argentina', 'Brazil', 'Chile',
    'Peru', 'Ecuador', 'Venezuela', 'Uruguay', 'Paraguay',
    'Bolivia', 'Costa Rica', 'Panama', 'Guatemala', 'El Salvador',
    'Honduras', 'Nicaragua', 'Dominican Republic', 'Puerto Rico'
  ],
  'EMEA': [
    'United Kingdom', 'Germany', 'France', 'Spain', 'Italy',
    'Netherlands', 'Poland', 'Romania', 'Belgium', 'Sweden',
    'UAE', 'Saudi Arabia', 'Egypt', 'South Africa', 'Kenya'
  ],
  'APAC': [
    'India', 'China', 'Japan', 'Singapore', 'Australia',
    'South Korea', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines',
    'Malaysia', 'New Zealand', 'Taiwan', 'Hong Kong'
  ],
  'NORTH AMERICA': [
    'United States', 'Canada'
  ],
  'NA': [
    'United States', 'Canada'
  ]
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SearchCriteria {
  skills: string[];
  title_keywords?: string[];
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
// Normalize location to handle ambiguous inputs
function normalizeLocation(location: string | undefined): string[] | undefined {
  if (!location || location.trim() === '' || location.toLowerCase().includes('global')) {
    return undefined; // Empty/global = no location filter (global search)
  }
  
  const normalized = location.trim().toUpperCase();
  
  // Handle regional shortcuts - expand to country lists
  const regionMap: Record<string, string[]> = {
    'LATAM': ['Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Guatemala', 'Costa Rica', 'Panama', 'Uruguay', 'Bolivia', 'Paraguay', 'Honduras', 'El Salvador', 'Nicaragua', 'Puerto Rico', 'Dominican Republic'],
    'LATIN AMERICA': ['Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 'Guatemala', 'Costa Rica', 'Panama', 'Uruguay', 'Bolivia', 'Paraguay', 'Honduras', 'El Salvador', 'Nicaragua', 'Puerto Rico', 'Dominican Republic'],
    'EUROPE': ['United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Portugal', 'Greece', 'Austria', 'Switzerland', 'Ireland'],
    'EUR': ['United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Portugal', 'Greece', 'Austria', 'Switzerland', 'Ireland'],
    'ASIA': ['India', 'China', 'Japan', 'Singapore', 'South Korea', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Malaysia'],
    'APAC': ['India', 'China', 'Japan', 'Singapore', 'Australia', 'New Zealand', 'South Korea', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Malaysia'],
    'NORTH AMERICA': ['United States', 'Canada', 'Mexico'],
    'NA': ['United States', 'Canada', 'Mexico']
  };
  
  // Check if the location matches a region
  for (const [region, countries] of Object.entries(regionMap)) {
    if (normalized.includes(region)) {
      console.log(`🌍 Expanding region "${location}" to ${countries.length} countries`);
      return countries;
    }
  }
  
  // Return as single location
  return [location];
}

function buildCoresignalFilterQuery(criteria: SearchCriteria): any {
  const query: any = {};
  
  // Skills: Use OR logic as per CoreSignal documentation
  if (criteria.skills && criteria.skills.length > 0) {
    query.skill = criteria.skills.map(skill => `(${skill})`).join(' OR ');
  }
  
  // Title Keywords: Use OR logic for experience_title field
  if (criteria.title_keywords && criteria.title_keywords.length > 0) {
    query.experience_title = criteria.title_keywords.map(title => `(${title})`).join(' OR ');
  }
  
  // Location: Parse intelligently to use both 'location' and 'country' fields
  // Support both singular 'location' and array 'locations' formats with normalization
  const rawLocationList = criteria.locations || (criteria.location ? [criteria.location] : []);
  
  // Normalize each location (handles regional expansion, empty/global filtering)
  const normalizedLocations: string[] = [];
  for (const loc of rawLocationList) {
    const normalized = normalizeLocation(loc);
    if (normalized) {
      normalizedLocations.push(...normalized);
    }
  }
  
  if (normalizedLocations.length > 0) {
    // For multiple locations, parse each and combine with OR
    const locationParts: string[] = [];
    const countryParts: string[] = [];
    
    normalizedLocations.forEach(loc => {
      let locationStr = loc.replace(/^Remote\s*-\s*/i, '').trim();
      const parts = locationStr.split(',').map(p => p.trim());
      
      if (parts.length >= 2) {
        // Multi-part location like "San Francisco, California"
        locationParts.push(parts.slice(0, -1).join(', '));
        countryParts.push(parts[parts.length - 1]);
      } else if (parts.length === 1) {
        // Check if it's a regional keyword
        const regionMatch = Object.keys(REGION_COUNTRY_MAPPING).find(region => 
          locationStr.toUpperCase().includes(region)
        );
        
        if (regionMatch) {
          countryParts.push(REGION_COUNTRY_MAPPING[regionMatch][0]);
        } else {
          locationParts.push(locationStr);
        }
      }
    });
    
    // Combine with OR operator
    if (locationParts.length > 0) {
      query.location = locationParts.map(l => `(${l})`).join(' OR ');
      console.log(`🌍 Combined locations: ${query.location}`);
    }
    if (countryParts.length > 0) {
      query.country = countryParts.map(c => `(${c})`).join(' OR ');
      console.log(`🌎 Combined countries: ${query.country}`);
    }
  } else {
    console.log(`🌍 No location filter (global search)`);
  }
  
  // Active experience only
  query.active_experience = true;
  
  return query;
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
          
          // Fetch cached candidates from database
          const { data: cachedCandidates, error: cacheError } = await supabase
            .from('coresignal_preview_candidates')
            .select('*')
            .eq('sourcing_project_id', project_id);
          
          if (cacheError) {
            console.warn('⚠️ Failed to fetch cached candidates:', cacheError);
          }
          
          // Map to expected format
          const candidates = (cachedCandidates || []).map(c => ({
            coresignal_id: c.coresignal_id,
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
          
          // Get current credits for response
          const creditCheck = await checkCreditAvailability(orgId, 'search');
          
          return new Response(JSON.stringify({
            candidates: candidates,
            total_count: project.coresignal_candidate_count || candidates.length,
            credits_used: 0,
            credits_remaining: creditCheck.remaining,
            cached: true
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...cors },
          });
        }
      }
    }

    // Check credit availability BEFORE making API call
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


    // Build CoreSignal query
    const queryParams = buildCoresignalFilterQuery(criteria);
    
    console.log('📡 CoreSignal API Request Details:', {
      url: `${CORESIGNAL_API_URL}?page=1`,
      method: 'POST',
      query: JSON.stringify(queryParams, null, 2),
      headers: {
        apikey: CORESIGNAL_API_KEY ? '***SET***' : '***MISSING***',
        'Content-Type': 'application/json'
      }
    });

    // Call CoreSignal API
    const coresignalResponse = await fetch(`${CORESIGNAL_API_URL}?page=1`, {
      method: 'POST',
      headers: {
        'apikey': CORESIGNAL_API_KEY,
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
    
    // Get total count from header
    const totalCount = parseInt(coresignalResponse.headers.get('x-total-results') || '0', 10);
    
    // Search Preview returns a direct array, not wrapped in 'results'
    const resultsArray = Array.isArray(coresignalData) ? coresignalData : [];
    
    console.log('📡 CoreSignal API Full Response:', {
      status: coresignalResponse.status,
      statusText: coresignalResponse.statusText,
      totalFromHeader: totalCount,
      returnedCount: resultsArray.length,
      firstCandidate: resultsArray[0] || null
    });

    // Parse preview results - map fields from Search Preview API
    const candidates: CoreSignalCandidate[] = resultsArray.slice(0, limit).map((candidate: any) => ({
      coresignal_id: candidate.id?.toString() || '',
      full_name: candidate.full_name || 'Unknown',
      headline: candidate.headline || '',
      location: candidate.location || '',
      country: candidate.country || '',
      profile_url: candidate.profile_url || '',
      current_company: candidate.company_name || null,
      current_title: candidate.title || null,
      experience_count: candidate.experience_count || 0,
      _score: candidate._score || 0,
      industry: candidate.industry || null,
      connections_count: candidate.connections_count || null,
      follower_count: candidate.follower_count || null,
      company_url: candidate.company_url || null,
      company_website: candidate.company_website || null,
      company_industry: candidate.company_industry || null,
      experience_location: candidate.experience_location || null
    }));

    // Store candidates in database for caching
    if (project_id && candidates.length > 0) {
      // Delete old cached candidates for this project
      await supabase
        .from('coresignal_preview_candidates')
        .delete()
        .eq('sourcing_project_id', project_id);
      
      // Insert new candidates
      const candidateRecords = candidates.map(c => ({
        sourcing_project_id: project_id,
        coresignal_id: c.coresignal_id,
        full_name: c.full_name,
        headline: c.headline,
        location: c.location,
        country: c.country,
        profile_url: c.profile_url,
        current_company: c.current_company,
        current_title: c.current_title,
        experience_count: c.experience_count,
        match_score: null,
        coresignal_score: c._score,
        industry: c.industry,
        connections_count: c.connections_count,
        follower_count: c.follower_count,
        company_url: c.company_url,
        company_website: c.company_website,
        company_industry: c.company_industry,
        experience_location: c.experience_location
      }));
      
      const { error: insertError } = await supabase
        .from('coresignal_preview_candidates')
        .insert(candidateRecords);
      
      if (insertError) {
        console.warn('⚠️ Failed to cache CoreSignal candidates:', insertError);
      } else {
        console.log(`✅ Cached ${candidateRecords.length} CoreSignal preview candidates`);
      }
    }

    // Increment credit usage
    await incrementCreditUsage(orgId, 'search');
    
    // Update project cache metadata if project_id provided
    if (project_id) {
      const cacheExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      await supabase
        .from('sourcing_projects')
        .update({
          coresignal_candidate_count: totalCount,
          coresignal_last_searched_at: new Date().toISOString(),
          coresignal_cache_expires_at: cacheExpiry.toISOString()
        })
        .eq('id', project_id);
    }

    const response = {
      candidates,
      total_count: totalCount,
      credits_used: 1,
      credits_remaining: creditCheck.remaining - 1,
      cached: false
    };

    console.log(`✅ CoreSignal search complete: ${candidates.length} candidates returned from ${totalCount} total matches (1 credit used, ${creditCheck.remaining - 1} remaining)`);

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
