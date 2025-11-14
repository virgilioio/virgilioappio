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
  locations?: string[];
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

// Helper to parse location strings from hierarchical format
// Formats: "City,State,Country" or "State,Country" or "Country"
function parseLocation(locationValue: string): { city?: string; state?: string; countryCode?: string } {
  const parts = locationValue.split(',').map(p => p.trim())
  
  if (parts.length === 3) {
    // City, State, Country Code
    return { city: parts[0], state: parts[1], countryCode: parts[2] }
  } else if (parts.length === 2) {
    // State, Country Code
    return { state: parts[0], countryCode: parts[1] }
  } else if (parts.length === 1) {
    // Country code only
    return { countryCode: parts[0] }
  }
  
  return {}
}

// Map country codes to full country names for CoreSignal API
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

// Convert country codes to country names
function convertCountryCodesToNames(codes: string[]): string[] {
  return codes.map(code => COUNTRY_CODE_TO_NAME[code] || code);
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
  
  // Location: Parse hierarchical format and send to CoreSignal
  if (criteria.locations && criteria.locations.length > 0) {
    const cityLocations: string[] = []
    const stateLocations: string[] = []
    const countries: string[] = []
    
    for (const locationValue of criteria.locations) {
      const parsed = parseLocation(locationValue)
      
      if (parsed.city) {
        // City level: Send only city name for better CoreSignal matching
        cityLocations.push(parsed.city)
      } else if (parsed.state) {
        // State/Province level: Now uses full state names (e.g., "Jalisco" not "JAL")
        stateLocations.push(parsed.state)
      }
      
      // Add country if available
      if (parsed.countryCode && COUNTRY_CODE_TO_NAME[parsed.countryCode]) {
        countries.push(COUNTRY_CODE_TO_NAME[parsed.countryCode])
      }
    }
    
    // Combine city and state locations for the "location" parameter
    const allLocations = [...cityLocations, ...stateLocations]
    if (allLocations.length > 0) {
      query.location = allLocations.map(loc => `(${loc})`).join(' OR ')
    }
    
    // Send countries separately if we have them
    if (countries.length > 0) {
      query.country = countries.map(c => `(${c})`).join(' OR ')
    }
    
    // Enhanced logging for debugging
    console.log('📍 Location Processing Details:', {
      rawLocations: criteria.locations,
      parsedCities: cityLocations,
      parsedStates: stateLocations,
      countries: countries,
      finalQuery: {
        location: query.location,
        country: query.country
      }
    })
  } else {
    console.log(`🌍 No location filter (global search)`)
  }
  
  // Active experience only
  query.active_experience = true;
  
  return query;
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
  // Get tenant_id from organization
  const tenant_id = await getTenantIdFromOrganization(organizationId);
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  
  // Calculate next reset date (first day of next month)
  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextReset = nextMonth.toISOString().slice(0, 10);
  
  // Get or create usage record for current month using tenant_id
  let { data: usage, error } = await supabase
    .from('coresignal_usage')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('billing_cycle_start', currentMonth)
    .single();
  
  // If no record exists, create one with tier-based limits
  if (error && error.code === 'PGRST116') {
    // Get tier-based limits
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

// Increment credit usage using atomic RPC
async function incrementCreditUsage(
  organizationId: string,
  type: 'search' | 'collect'
): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  // Get tenant_id from organization
  const tenant_id = await getTenantIdFromOrganization(organizationId);
  
  // Use the atomic RPC to increment credits
  const { error } = await supabase.rpc('increment_coresignal_usage', {
    p_tenant_id: tenant_id,
    p_credit_type: type
  });
  
  if (error) {
    console.error(`Failed to increment ${type} credit usage:`, error);
    throw error;
  }
  
  console.log(`Successfully incremented ${type} credit for tenant ${tenant_id}`);
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { project_id, criteria, limit = 200, organization_id }: SearchRequest = await req.json(); // Increased to get more candidates per search

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

    // Handle multiple locations with sequential searches
    let allCandidates: CoreSignalCandidate[] = [];
    let totalCount = 0;
    let creditsUsedInSearch = 0;
    const MAX_LOCATIONS = 3; // Limit to 3 locations to control costs
    
    // Check if we have multiple locations
    const hasMultipleLocations = criteria.locations && criteria.locations.length > 1;
    
    if (hasMultipleLocations) {
      const locationsToSearch = criteria.locations.slice(0, MAX_LOCATIONS);
      console.log(`🔍 Multiple locations detected (${criteria.locations.length}), making ${locationsToSearch.length} sequential searches...`);
      
      const seenIds = new Set<string>();
      
      // Make sequential searches for each location
      for (let i = 0; i < locationsToSearch.length; i++) {
        const location = locationsToSearch[i];
        console.log(`📍 Search ${i + 1}/${locationsToSearch.length}: ${location}`);
        
        // Check if we still have credits
        const currentCreditCheck = await checkCreditAvailability(orgId, 'search');
        if (!currentCreditCheck.available) {
          console.warn(`❌ Credits exhausted after ${i} searches`);
          break;
        }
        
        // Build query for single location
        const singleLocationCriteria = { ...criteria, locations: [location] };
        const queryParams = buildCoresignalFilterQuery(singleLocationCriteria);
        
        console.log(`📡 CoreSignal API Request ${i + 1}:`, {
          url: `${CORESIGNAL_API_URL}?page=1`,
          location: location,
          query: JSON.stringify(queryParams, null, 2)
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
          console.error(`❌ CoreSignal API error for location ${location}:`, errorText);
          continue; // Skip this location and try next
        }

        const coresignalData = await coresignalResponse.json();
        const locationTotalCount = parseInt(coresignalResponse.headers.get('x-total-results') || '0', 10);
        const resultsArray = Array.isArray(coresignalData) ? coresignalData : [];
        
        console.log(`✅ Location "${location}": ${resultsArray.length} candidates (${locationTotalCount} total matches)`);
        
        // Deduplicate by ID and add to results
        let addedCount = 0;
        for (const candidate of resultsArray) {
          const candidateId = candidate.id?.toString() || candidate.profile_url;
          if (!seenIds.has(candidateId)) {
            seenIds.add(candidateId);
            allCandidates.push({
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
            });
            addedCount++;
          }
        }
        
        console.log(`➕ Added ${addedCount} unique candidates from "${location}" (${resultsArray.length - addedCount} duplicates skipped)`);
        
        totalCount += locationTotalCount;
        
        // Increment credit for this search
        await incrementCreditUsage(orgId, 'search');
        creditsUsedInSearch++;
        
        // Limit total candidates to the requested limit
        if (allCandidates.length >= limit) {
          console.log(`🎯 Reached limit of ${limit} candidates, stopping search`);
          allCandidates = allCandidates.slice(0, limit);
          break;
        }
      }
      
      console.log(`📊 Multi-location search complete: ${allCandidates.length} unique candidates from ${creditsUsedInSearch} searches (${totalCount} total matches across all locations)`);
      
    } else {
      // Single location or no location - original logic
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
      totalCount = parseInt(coresignalResponse.headers.get('x-total-results') || '0', 10);
      const resultsArray = Array.isArray(coresignalData) ? coresignalData : [];
      
      console.log('📡 CoreSignal API Full Response:', {
        status: coresignalResponse.status,
        statusText: coresignalResponse.statusText,
        totalFromHeader: totalCount,
        returnedCount: resultsArray.length,
        firstCandidate: resultsArray[0] || null
      });

      // Parse preview results
      allCandidates = resultsArray.slice(0, limit).map((candidate: any) => ({
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
      
      // Increment credit usage for single search
      await incrementCreditUsage(orgId, 'search');
      creditsUsedInSearch = 1;
    }

    const candidates = allCandidates;

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

    // Increment credit has been done in the loop above for multi-location
    // or in the single location block
    
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
      credits_used: creditsUsedInSearch,
      credits_remaining: creditCheck.remaining - creditsUsedInSearch,
      cached: false
    };

    console.log(`✅ CoreSignal search complete: ${candidates.length} candidates returned from ${totalCount} total matches (${creditsUsedInSearch} credit(s) used, ${creditCheck.remaining - creditsUsedInSearch} remaining)`);

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
