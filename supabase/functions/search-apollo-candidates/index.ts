import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
// CORRECT Apollo endpoint for searching (api_search, not search)
const APOLLO_API_URL = 'https://api.apollo.io/api/v1/mixed_people/api_search';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SearchCriteria {
  title_keywords?: string[];
  locations?: string[];
  seniorities?: string[];
  organization_locations?: string[];
  keywords?: string[];  // General keyword search (q_keywords) - joined with spaces
  company_sizes?: string[];  // '1,10', '11,50', etc. (organization_num_employees_ranges)
  company_domains?: string[];  // Target company domains
  company_names?: string[];  // Target company names (q_organization_name)
  industries?: string[];  // Industry filter → organization_industry_tag_ids[]
  // Note: skills are NOT supported by Apollo search - only titles and locations
}

interface SearchRequest {
  project_id?: string;
  criteria: SearchCriteria;
  limit?: number;
  max_results?: number;  // Max total results to fetch (default: 300, max: 500)
  organization_id?: string;
}

// Apollo SEARCH API response - ONLY preview data, NOT full profiles
// Based on actual API testing: search returns obfuscated names and availability flags ONLY
// Full data (linkedin_url, email, phone, location values) requires ENRICHMENT
interface ApolloSearchCandidate {
  id: string;
  first_name: string;
  last_name_obfuscated: string;  // Obfuscated: "Hu***n" - ALWAYS obfuscated in search
  // These fields are NOT returned by search API - only after enrichment:
  // last_name, name, linkedin_url, email, city, state, country (actual values)
  title?: string | null;
  last_refreshed_at?: string;
  // Availability flags - indicate what CAN be revealed after enrichment
  has_email?: boolean;
  has_city?: boolean;
  has_state?: boolean;
  has_country?: boolean;
  has_direct_phone?: string;  // "Yes" or "No"
  organization?: {
    name: string;
    has_industry?: boolean;
    has_phone?: boolean;
    has_city?: boolean;
    has_state?: boolean;
    has_country?: boolean;
    has_zip_code?: boolean;
    has_revenue?: boolean;
    has_employee_count?: boolean;
  };
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

// US State abbreviations to full names
const US_STATE_ABBR_TO_NAME: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

/**
 * Convert our internal location format to Apollo's expected format
 * Our format: "City,State,CountryCode" (e.g., "San Francisco,California,US")
 * Apollo format: "State, Country" or "City, Country" (e.g., "California, United States")
 */
function formatLocationForApollo(locationValue: string): string | null {
  const parts = locationValue.split(',').map(p => p.trim());
  
  if (parts.length === 3) {
    // "City,State,Country" → "City, Country" for Apollo
    const city = parts[0];
    const countryCode = parts[2];
    const countryName = COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
    return `${city}, ${countryName}`;
  } else if (parts.length === 2) {
    // "State,Country" → "State, Country"
    const state = parts[0];
    const countryCode = parts[1];
    const countryName = COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
    
    // Expand US state abbreviations if applicable
    const expandedState = US_STATE_ABBR_TO_NAME[state.toUpperCase()] || state;
    return `${expandedState}, ${countryName}`;
  } else if (parts.length === 1) {
    // Just country code → country name
    const countryCode = parts[0];
    return COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
  }
  
  return null;
}

/**
 * Deduplicate keywords by removing terms that already appear in title_keywords
 * This prevents redundant AND conditions in Apollo's search
 */
function deduplicateKeywords(keywords: string[], titleKeywords: string[]): string[] {
  if (!keywords?.length || !titleKeywords?.length) return keywords || [];
  
  // Build a set of words from all title keywords (lowercase for comparison)
  const titleWords = new Set<string>();
  titleKeywords.forEach(title => {
    title.toLowerCase().split(/[\s,]+/).forEach(word => {
      if (word.length > 2) titleWords.add(word); // Skip very short words like "of", "in"
    });
  });
  
  // Filter out keywords that are redundant with titles
  return keywords.filter(keyword => {
    const keywordLower = keyword.toLowerCase();
    // Check if all words in this keyword appear in titles (fully redundant)
    const keywordWords = keywordLower.split(/\s+/);
    const isRedundant = keywordWords.every(word => word.length <= 2 || titleWords.has(word));
    
    if (isRedundant) {
      console.log(`⚠️ Skipping redundant keyword "${keyword}" (already covered by titles)`);
    }
    return !isRedundant;
  });
}

/**
 * Build Apollo API request URL with query parameters
 * Apollo uses URL query params, not JSON body for api_search
 */
function buildApolloSearchUrl(criteria: SearchCriteria, perPage: number = 100, page: number = 1): string {
  const params = new URLSearchParams();
  
  // Title keywords → person_titles[] (CURRENT JOB TITLE filter)
  // Note: Apollo's person_titles already does fuzzy matching by default
  if (criteria.title_keywords && criteria.title_keywords.length > 0) {
    criteria.title_keywords.slice(0, 10).forEach(title => {
      params.append('person_titles[]', title);
    });
    console.log(`🎯 Apollo title filter (fuzzy matching ON): ${criteria.title_keywords.join(', ')}`);
  }

  // Keywords and company names are mutually exclusive to avoid over-filtering with AND logic
  // Priority: company_names > keywords (company filter is more specific)
  if (criteria.company_names && criteria.company_names.length > 0) {
    // Target company names → q_organization_name (searches by company name)
    const companyNamesString = criteria.company_names.slice(0, 10).join(' OR ');
    params.append('q_organization_name', companyNamesString);
    console.log(`🏢 Apollo target company names: ${companyNamesString}`);
  } else if (criteria.keywords && criteria.keywords.length > 0) {
    // Deduplicate: remove keywords already covered by title_keywords to prevent over-filtering
    const uniqueKeywords = deduplicateKeywords(criteria.keywords, criteria.title_keywords || []);
    
    if (uniqueKeywords.length > 0) {
      const keywordsString = uniqueKeywords.slice(0, 5).join(' ');
      params.append('q_keywords', keywordsString);
      console.log(`🔑 Apollo keywords (deduplicated): ${keywordsString}`);
    } else {
      console.log(`⚠️ All keywords redundant with titles - skipping q_keywords for broader results`);
    }
  }

  // Locations → person_locations[]
  if (criteria.locations && criteria.locations.length > 0) {
    for (const loc of criteria.locations) {
      const apolloLocation = formatLocationForApollo(loc);
      if (apolloLocation) {
        params.append('person_locations[]', apolloLocation);
      }
    }
    console.log(`📍 Apollo locations: ${criteria.locations.join(', ')}`);
  }

  // Seniority filter → person_seniorities[]
  if (criteria.seniorities && criteria.seniorities.length > 0) {
    const apolloSeniorities = criteria.seniorities
      .map(s => SENIORITY_MAPPING[s.toLowerCase()] || s.toLowerCase())
      .filter(Boolean);
    
    apolloSeniorities.forEach(seniority => {
      params.append('person_seniorities[]', seniority);
    });
    console.log(`📊 Apollo seniority: ${apolloSeniorities.join(', ')}`);
  }

  // Company size filter → organization_num_employees_ranges[]
  if (criteria.company_sizes && criteria.company_sizes.length > 0) {
    criteria.company_sizes.forEach(size => {
      params.append('organization_num_employees_ranges[]', size);
    });
    console.log(`🏢 Apollo company sizes: ${criteria.company_sizes.join(', ')}`);
  }

  // Target company domains → q_organization_domains_list[]
  if (criteria.company_domains && criteria.company_domains.length > 0) {
    criteria.company_domains.forEach(domain => {
      params.append('q_organization_domains_list[]', domain);
    });
    console.log(`🎯 Apollo target company domains: ${criteria.company_domains.join(', ')}`);
  }

  // NOTE: company_names is now handled above with keywords (mutually exclusive)
  // This avoids the AND logic between q_organization_name and q_keywords
  
  // REMOVED: Industry filter (organization_industry_tag_ids[])
  // Apollo requires NUMERIC tag IDs for industries, not text strings like "SaaS"
  // Passing text strings causes 422 errors or returns 0 results
  // Industry is redundant anyway when filtering by company names
  if (criteria.industries && criteria.industries.length > 0) {
    console.log(`⚠️ Skipping industry filter (requires Apollo numeric IDs): ${criteria.industries.join(', ')}`);
  }

  // Pagination
  params.append('per_page', String(perPage));
  params.append('page', String(page));

  return `${APOLLO_API_URL}?${params.toString()}`;
}

/**
 * Map Apollo SEARCH result to our preview format
 * IMPORTANT: Search API returns ONLY preview data with obfuscated names and availability flags
 * Full data (linkedin_url, email, phone, location values) is ONLY available after ENRICHMENT
 */
function mapApolloSearchCandidate(apolloCandidate: ApolloSearchCandidate): any {
  // Construct display name with obfuscated last name (e.g., "Andrew Hu***n")
  const displayName = `${apolloCandidate.first_name} ${apolloCandidate.last_name_obfuscated}`.trim();

  // Determine location availability (NOT actual values - those come from enrichment)
  const hasLocation = apolloCandidate.has_city || apolloCandidate.has_state || apolloCandidate.has_country;

  return {
    apollo_id: apolloCandidate.id,
    full_name: displayName,
    first_name: apolloCandidate.first_name,
    last_name_obfuscated: apolloCandidate.last_name_obfuscated,
    headline: apolloCandidate.title || null,
    current_title: apolloCandidate.title || null,
    current_company: apolloCandidate.organization?.name || null,
    // ❌ NOT available in search - will be null until enrichment
    profile_url: null,
    linkedin_url: null,
    location: null,
    city: null,
    state: null,
    country: null,
    email: null,
    phone: null,
    email_status: null,
    // ✅ Availability flags - indicate what CAN be revealed after enrichment
    has_email: apolloCandidate.has_email ?? false,
    has_phone: apolloCandidate.has_direct_phone === 'Yes',
    has_location: hasLocation,
    // Company availability info
    company_has_phone: apolloCandidate.organization?.has_phone ?? false,
    company_has_industry: apolloCandidate.organization?.has_industry ?? false,
    // Flag indicating this is preview data that needs enrichment
    is_preview: true,
    needs_enrichment: true,
    _score: 100
  };
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { project_id, criteria, limit = 100, max_results = 300, organization_id }: SearchRequest = await req.json();

    // Clamp max_results between 100 and 500
    const effectiveMaxResults = Math.min(Math.max(max_results, 100), 500);
    
    console.log('🚀 Apollo Search Request:', { project_id, criteria, limit, max_results: effectiveMaxResults });

    // Validate API key
    if (!APOLLO_API_KEY) {
      throw new Error('APOLLO_API_KEY not configured');
    }

    // Determine organization ID (needed for caching, not credits)
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

    // Check cache if project_id provided
    if (project_id) {
      const { data: project } = await supabase
        .from('sourcing_projects')
        .select('sourcing_cache_expires_at, sourcing_candidate_count')
        .eq('id', project_id)
        .single();
      
      if (project?.sourcing_cache_expires_at) {
        const cacheExpiry = new Date(project.sourcing_cache_expires_at);
        if (cacheExpiry > new Date()) {
          console.log('✅ Using cached Apollo results');
          
          const { data: cachedCandidates } = await supabase
            .from('sourcing_preview_candidates')
            .select('*')
            .eq('sourcing_project_id', project_id);
          
          const candidates = (cachedCandidates || []).map(c => ({
            apollo_id: c.apollo_id,
            full_name: c.full_name,
            first_name: c.first_name,
            last_name_obfuscated: c.last_name_obfuscated,
            headline: c.headline,
            current_company: c.current_company,
            current_title: c.current_title,
            // ✅ Availability flags from cache
            has_email: c.has_email ?? false,
            has_phone: c.has_phone ?? false,
            has_location: c.has_location ?? false,
            // ❌ These are NULL in search results - only available after enrichment
            profile_url: null,
            linkedin_url: null,
            location: null,
            email: null,
            phone: null,
            is_preview: true,
            needs_enrichment: true,
            _score: c.match_score
          }));
          
          return new Response(JSON.stringify({
            candidates,
            total_count: project.sourcing_candidate_count || candidates.length,
            credits_used: 0,  // Search is FREE
            cached: true,
            provider: 'apollo',
            search_is_free: true
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...cors },
          });
        }
      }
    }

    // IMPORTANT: Apollo Search is FREE - no credit check needed!
    // Credits are only consumed when enriching/revealing contact info
    console.log('💡 Apollo search is FREE - no credits consumed');

    // Multi-page fetching configuration
    const PER_PAGE = 100;  // Apollo max is 100 per page
    const MAX_PAGES = Math.ceil(effectiveMaxResults / PER_PAGE);
    const DELAY_BETWEEN_PAGES = 200;  // ms - respect rate limits

    // Fetch first page
    const page1Url = buildApolloSearchUrl(criteria, PER_PAGE, 1);
    console.log('📡 Apollo API Request URL (page 1):', page1Url);

    const apolloResponse = await fetch(page1Url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
        'accept': 'application/json'
      }
    });

    if (!apolloResponse.ok) {
      const errorText = await apolloResponse.text();
      console.error('❌ Apollo API Error:', apolloResponse.status, errorText);
      throw new Error(`Apollo API error: ${apolloResponse.status} - ${errorText}`);
    }

    const apolloData = await apolloResponse.json();
    const totalAvailable = apolloData.total_entries || 0;
    
    // Collect all candidates from first page
    let allApolloPeople: any[] = [...(apolloData.people || [])];
    
    console.log(`✅ Apollo page 1 returned ${apolloData.people?.length || 0} candidates (total available: ${totalAvailable})`);

    // Calculate how many more pages to fetch
    const pagesNeeded = Math.min(MAX_PAGES, Math.ceil(Math.min(totalAvailable, effectiveMaxResults) / PER_PAGE));
    
    // Fetch additional pages if available and needed
    for (let page = 2; page <= pagesNeeded && allApolloPeople.length < effectiveMaxResults; page++) {
      // Respect rate limits with delay between requests
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PAGES));
      
      const pageUrl = buildApolloSearchUrl(criteria, PER_PAGE, page);
      console.log(`📡 Apollo API Request URL (page ${page}):`, pageUrl);
      
      try {
        const pageResponse = await fetch(pageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': APOLLO_API_KEY,
            'accept': 'application/json'
          }
        });
        
        if (!pageResponse.ok) {
          console.warn(`⚠️ Apollo page ${page} failed:`, pageResponse.status);
          break;  // Stop fetching more pages on error
        }
        
        const pageData = await pageResponse.json();
        const pagePeople = pageData.people || [];
        allApolloPeople.push(...pagePeople);
        
        console.log(`✅ Apollo page ${page} returned ${pagePeople.length} candidates (total collected: ${allApolloPeople.length})`);
        
        // Stop if we've collected enough
        if (allApolloPeople.length >= effectiveMaxResults) {
          break;
        }
      } catch (pageError) {
        console.warn(`⚠️ Error fetching Apollo page ${page}:`, pageError);
        break;  // Stop on error
      }
    }
    
    console.log(`📊 Total Apollo candidates fetched: ${allApolloPeople.length} from ${Math.min(pagesNeeded, Math.ceil(allApolloPeople.length / PER_PAGE))} pages`);

    // 🔍 DEBUG: Log the raw Apollo response structure to see actual field names
    if (allApolloPeople.length > 0) {
      const sample = allApolloPeople[0];
      console.log('📦 SAMPLE RAW APOLLO RESPONSE:', JSON.stringify({
        id: sample.id,
        first_name: sample.first_name,
        last_name: sample.last_name,
        last_name_obfuscated: sample.last_name_obfuscated,
        name: sample.name,
        title: sample.title,
        headline: sample.headline,
        // Check all possible LinkedIn URL field names
        linkedin_url: sample.linkedin_url,
        linkedinUrl: sample.linkedinUrl,
        linkedin: sample.linkedin,
        // Check all possible location field names
        city: sample.city,
        state: sample.state,
        country: sample.country,
        location: sample.location,
        present_raw_address: sample.present_raw_address,
        // Organization nested object
        organization: sample.organization,
        // All keys on the object
        allKeys: Object.keys(sample)
      }, null, 2));
    }

    // Map Apollo candidates to our format (limit to effectiveMaxResults)
    const candidates = allApolloPeople.slice(0, effectiveMaxResults).map(mapApolloSearchCandidate);
    const totalCount = totalAvailable;

    // Store in cache if project_id provided
    if (project_id && candidates.length > 0) {
      // Clear old cache
      await supabase
        .from('sourcing_preview_candidates')
        .delete()
        .eq('sourcing_project_id', project_id);

      // Insert new candidates with availability flags (NOT actual values - those come from enrichment)
      // Increased limit to 300 to match multi-page fetching
      const candidatesToInsert = candidates.slice(0, 300).map((c: any) => ({
        sourcing_project_id: project_id,
        apollo_id: c.apollo_id,
        full_name: c.full_name,
        first_name: c.first_name,
        last_name_obfuscated: c.last_name_obfuscated,
        headline: c.headline,
        current_company: c.current_company,
        current_title: c.current_title,
        // ✅ Store availability flags
        has_email: c.has_email ?? false,
        has_phone: c.has_phone ?? false,
        has_location: c.has_location ?? false,
        match_score: c._score,
        // ❌ These are null in search results
        profile_url: null,
        location: null,
        country: null
      }));

      const { error: insertError } = await supabase
        .from('sourcing_preview_candidates')
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
          sourcing_cache_expires_at: cacheExpiry.toISOString(),
          sourcing_candidate_count: totalCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', project_id);
    }

    return new Response(JSON.stringify({
      candidates,
      total_count: totalCount,
      credits_used: 0,  // Search is FREE
      cached: false,
      provider: 'apollo',
      search_is_free: true,
      message: 'Search is free. Credits are only used when revealing contact info.'
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
