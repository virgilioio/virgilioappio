import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================================
// TYPES
// ============================================================================

interface SearchRequest {
  organization_id: string;
  job_id?: string;
  query: {
    boolean?: string;
    titles?: string[];
    keywords?: string[];
    locations?: string[];
    languages?: string[];
    seniority?: string[];
    has_email?: "only" | "any";
    has_phone?: "only" | "any";
    updated_within_days?: number;
  };
  pagination?: {
    page: number;
    pageSize: number;
  };
}

interface SearchResult {
  provider_code: "coresignal";
  provider_ref: string;
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  profileUrl?: string;
  lastUpdatedAt?: string;
  match: number;
}

interface SearchResponse {
  total: number;
  items: SearchResult[];
  cache: {
    hit: boolean;
    ttl_seconds: number;
  };
  credits: {
    charged: number;
    remaining?: number;
  };
}

interface CoreSignalEmployee {
  id: string;
  full_name?: string;
  name?: string; // fallback
  title?: string; // fallback if experience not available
  company_name?: string;
  location?: string;
  profile_url?: string;
  linkedin_url?: string; // fallback
  updated_at?: string;
  last_updated?: string; // fallback
  country?: string;
  country_iso_2?: string;
  country_iso_3?: string;
  experience?: Array<{
    title?: string;
    is_current?: number;
    order_in_profile?: number;
    [key: string]: any;
  }>;
  skills?: Array<{
    skill?: string;
    [key: string]: any;
  } | string>;
  languages?: Array<{
    language?: string;
    [key: string]: any;
  } | string>;
  [key: string]: any;
}

// ============================================================================
// UTILITIES
// ============================================================================

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SOURCING-SEARCH] ${step}${detailsStr}`);
};

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a deterministic cache key for the search query
 */
function generateCacheKey(orgId: string, jobId: string | undefined, query: any, page: number): string {
  const queryStr = JSON.stringify({ query, page });
  const hash = hashString(queryStr);
  return `${orgId}:${jobId ?? "none"}:${hash}:${page}`;
}

/**
 * Simple string hash function for cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Sanitize an object by removing undefined values
 */
function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const sanitized: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      sanitized[key as keyof T] = value;
    }
  }
  return sanitized;
}

/**
 * Zod schema for input validation
 */
const SearchRequestSchema = z.object({
  organization_id: z.string().uuid("organization_id must be a valid UUID"),
  job_id: z.string().uuid("job_id must be a valid UUID").nullable().optional(),
  query: z.object({
    boolean: z.string().min(1, "query.boolean cannot be empty").optional(),
    titles: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    seniority: z.array(z.string()).optional(),
    has_email: z.enum(['only', 'any']).optional(),
    has_phone: z.enum(['only', 'any']).optional(),
    updated_within_days: z.coerce.number().int().min(1).max(365).optional().nullable()
      .transform(v => (v == null ? undefined : v)),
    require_email: z.boolean().optional().nullable()
      .transform(v => (v == null ? undefined : v)),
    require_phone: z.boolean().optional().nullable()
      .transform(v => (v == null ? undefined : v))
  }),
  pagination: z.object({
    page: z.number().int().min(1, "pagination.page must be >= 1"),
    pageSize: z.number().int().min(1).max(100, "pagination.pageSize must be between 1 and 100")
  }).optional()
});

/**
 * Validate and normalize search request input using Zod
 */
function validateRequest(body: any, requestId: string): { valid: boolean; error?: string; normalized?: any } {
  try {
    const parsed = SearchRequestSchema.parse(body);
    
    // Sanitize the query object to remove undefined values
    const normalizedQuery = sanitizeObject(parsed.query);
    
    // Debug log in development/diagnostic mode
    if (Deno.env.get('LOG_LEVEL') === 'debug') {
      logStep("Normalized query", { requestId, normalizedQuery });
    }
    
    // Additional validation: ensure boolean is present if no other query params
    if (!normalizedQuery.boolean && 
        !normalizedQuery.titles?.length && 
        !normalizedQuery.keywords?.length && 
        !normalizedQuery.locations?.length) {
      return { 
        valid: false, 
        error: "query.boolean is required when no other query parameters are provided" 
      };
    }
    
    return { 
      valid: true, 
      normalized: {
        ...parsed,
        query: normalizedQuery
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      const message = `${firstError.path.join('.')}: ${firstError.message}`;
      logStep("Validation failed", { requestId, error: message, issues: error.errors });
      return { valid: false, error: message };
    }
    return { valid: false, error: "Invalid request format" };
  }
}

/**
 * Check if user belongs to the organization
 */
async function checkOrgPermission(
  supabaseClient: any,
  userId: string,
  organizationId: string
): Promise<{ allowed: boolean; error?: string }> {
  const { data, error } = await supabaseClient
    .from('members')
    .select('id, user_status, organization_id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('user_status', 'active')
    .single();

  if (error || !data) {
    logStep("Permission check failed", { userId, organizationId, error });
    return { allowed: false, error: "User not authorized for this organization" };
  }

  return { allowed: true };
}

/**
 * Check cache for existing results
 */
async function checkCache(
  supabaseClient: any,
  cacheKey: string
): Promise<{ hit: boolean; data?: any; ttl_seconds: number }> {
  const CACHE_TTL = 15 * 60; // 15 minutes in seconds
  const cutoffTime = new Date(Date.now() - CACHE_TTL * 1000).toISOString();

  // For simplicity, we'll use external_candidate_matches as cache
  // In production, consider a dedicated cache table with expires_at
  const { data, error } = await supabaseClient
    .from('external_candidate_matches')
    .select('*')
    .gte('created_at', cutoffTime)
    .eq('raw_data->>cache_key', cacheKey)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) {
    return { hit: false, ttl_seconds: CACHE_TTL };
  }

  logStep("Cache hit", { cacheKey, records: data.length });

  const items: SearchResult[] = data.map(row => ({
    provider_code: "coresignal" as const,
    provider_ref: row.provider_id,
    name: row.candidate_name,
    title: row.current_title,
    company: row.current_company,
    location: row.location_city && row.location_country 
      ? `${row.location_city}, ${row.location_country}`
      : row.location_country || undefined,
    profileUrl: row.linkedin_url,
    lastUpdatedAt: row.updated_at,
    match: row.match_score || 0
  }));

  const remainingTTL = Math.max(
    0,
    CACHE_TTL - Math.floor((Date.now() - new Date(data[0].created_at).getTime()) / 1000)
  );

  return {
    hit: true,
    data: { items, total: items.length },
    ttl_seconds: remainingTTL
  };
}

/**
 * Build CoreSignal REST API filter payload for Base Employee v2 filter endpoint
 * Strips null/empty values and formats for the /v2/employee_base/search/filter endpoint
 */
function buildCoreSignalFilterPayload(
  query: SearchRequest['query'], 
  pagination: { page: number; pageSize: number }
): Record<string, any> {
  const payload: Record<string, any> = {};

  // Title - take first title if multiple provided
  if (query.titles && query.titles.length > 0) {
    const title = query.titles[0]?.trim();
    if (title) {
      payload.title = title;
    }
  }

  // Keywords - dedupe and take top 10 from skills/keywords
  const allKeywords = [...(query.keywords || [])];
  const uniqueKeywords = [...new Set(allKeywords.map(k => k?.trim()).filter(Boolean))];
  if (uniqueKeywords.length > 0) {
    payload.keywords = uniqueKeywords.slice(0, 10);
  }

  // Locations - city/region/country tokens
  if (query.locations && query.locations.length > 0) {
    const cleanLocations = query.locations.map(l => l?.trim()).filter(Boolean);
    if (cleanLocations.length > 0) {
      payload.locations = cleanLocations;
    }
  }

  // Languages - as strings
  if (query.languages && query.languages.length > 0) {
    const cleanLanguages = query.languages.map(l => l?.trim()).filter(Boolean);
    if (cleanLanguages.length > 0) {
      payload.languages = cleanLanguages;
    }
  }

  // Updated within days - integer only
  if (query.updated_within_days && Number.isInteger(query.updated_within_days) && query.updated_within_days > 0) {
    payload.updated_within_days = query.updated_within_days;
  }

  // Pagination - clamp page_size to 1..100
  const pageSize = Math.max(1, Math.min(pagination.pageSize ?? 25, 100));
  const page = Math.max(1, pagination.page ?? 1);
  
  if (page > 1) {
    payload.page = page;
  }
  if (pageSize !== 25) { // Only include if not default
    payload.page_size = pageSize;
  }

  // Note: Boolean query is NOT included here - v2 filter endpoint uses structured filters
  // Note: require_email and require_phone are excluded - Base Employee search doesn't support them

  return payload;
}

/**
 * Build CoreSignal ES-DSL API request for Base Employee index
 */
function buildCoreSignalRequest(query: SearchRequest['query'], pagination: { page: number; pageSize: number }) {
  const must: any[] = [];
  const filter: any[] = [];
  const should: any[] = [];

  // 1) Pagination
  const pageSize = Math.max(1, Math.min(pagination.pageSize ?? 25, 100));
  const from = Math.max(0, (pagination.page ?? 1) - 1) * pageSize;

  // 2) Title → nested current experience
  if (query.titles && query.titles.length > 0) {
    const title = query.titles[0].trim();
    if (title) {
      must.push({
        nested: {
          path: "experience",
          query: {
            bool: {
              must: [
                { match_phrase: { "experience.title": title } },
                { term: { "experience.is_current": 1 } }
              ]
            }
          }
        }
      });
    }
  }

  // 3) Boolean query → top-level query_string
  if (query.boolean?.trim()) {
    must.push({
      query_string: {
        query: query.boolean.trim(),
        default_operator: "AND"
      }
    });
  }

  // 4) Skills → nested skills with match_phrase
  const skills = query.keywords || [];
  if (Array.isArray(skills) && skills.length > 0) {
    const skillClauses = skills.slice(0, 10).map(skill => ({
      match_phrase: { "skills.skill": skill }
    }));
    
    if (skillClauses.length > 0) {
      must.push({
        nested: {
          path: "skills",
          query: {
            bool: {
              should: skillClauses,
              minimum_should_match: 1
            }
          }
        }
      });
    }
  }

  // 5) Location mapping (country vs free-text)
  if (Array.isArray(query.locations) && query.locations.length > 0) {
    const locations = query.locations.filter(l => l?.trim());
    
    if (locations.length > 0) {
      // Check if locations look like country codes/names
      const isCountryBased = locations.every(loc => {
        const normalized = loc.trim();
        // 2-letter ISO codes, 3-letter ISO codes, or common country names
        return normalized.length === 2 || 
               normalized.length === 3 || 
               ['United States', 'Mexico', 'Canada', 'United Kingdom', 'Germany', 'France', 'Spain', 'Italy'].some(c => 
                 normalized.toLowerCase().includes(c.toLowerCase())
               );
      });

      if (isCountryBased) {
        // Use country field with terms
        const countryTerms: any = {};
        
        // Determine which field to use based on format
        const twoLetterCodes = locations.filter(l => l.length === 2);
        const threeLetterCodes = locations.filter(l => l.length === 3);
        const countryNames = locations.filter(l => l.length > 3);

        if (twoLetterCodes.length > 0) {
          filter.push({ terms: { "country_iso_2": twoLetterCodes } });
        }
        if (threeLetterCodes.length > 0) {
          filter.push({ terms: { "country_iso_3": threeLetterCodes } });
        }
        if (countryNames.length > 0) {
          filter.push({ terms: { "country": countryNames } });
        }
      } else {
        // Free-text city/region search using top-level location
        const locationClauses = locations.map(loc => ({
          match_phrase: { "location": loc }
        }));

        filter.push({
          bool: {
            should: locationClauses,
            minimum_should_match: 1
          }
        });
      }
    }
  }

  // 6) Updated within N days
  if (typeof query.updated_within_days === 'number' && query.updated_within_days > 0) {
    filter.push({
      range: {
        updated_at: {
          gte: `now-${query.updated_within_days}d`
        }
      }
    });
  }

  // 7) Languages → nested languages
  if (Array.isArray(query.languages) && query.languages.length > 0) {
    const languageClauses = query.languages
      .filter(lang => lang?.trim())
      .map(lang => ({
        match_phrase: { "languages.language": lang.toLowerCase() }
      }));

    if (languageClauses.length > 0) {
      must.push({
        nested: {
          path: "languages",
          query: {
            bool: {
              should: languageClauses,
              minimum_should_match: 1
            }
          }
        }
      });
    }
  }

  // 8) DO NOT send has_email/has_phone for Base Employee (not supported)
  // These fields don't exist in Base Employee index

  // 9) Build final query object
  const hasConstraints = must.length > 0 || filter.length > 0 || should.length > 0;
  
  const finalQuery: any = {
    from,
    size: pageSize
  };

  if (hasConstraints) {
    const boolQuery: any = {};
    if (must.length > 0) boolQuery.must = must;
    if (filter.length > 0) boolQuery.filter = filter;
    if (should.length > 0) {
      boolQuery.should = should;
      boolQuery.minimum_should_match = 0;
    }
    finalQuery.query = { bool: boolQuery };
  } else {
    finalQuery.query = { match_all: {} };
  }

  // 10) Add _source to narrow payload (optional but recommended)
  finalQuery._source = [
    "id",
    "full_name",
    "location",
    "profile_url",
    "updated_at",
    "experience",
    "skills",
    "country",
    "country_iso_2",
    "country_iso_3"
  ];

  // 11) Sorting (use default ES score)
  finalQuery.sort = ["_score"];

  return finalQuery;
}

/**
 * Call CoreSignal API with retry logic
 */
async function callCoreSignalAPI(
  apiKey: string,
  request: any,
  requestId: string,
  maxRetries = 2
): Promise<{ results: CoreSignalEmployee[]; total: number; creditsRemaining?: number; providerRequestId?: string }> {
  // Build URL with normalized slashes
  const base = (Deno.env.get('CORESIGNAL_BASE_URL') ?? 'https://api.coresignal.com').replace(/\/+$/, '');
  
  // Feature flag: Use ES-DSL preview endpoint if enabled, otherwise use REST filters endpoint
  const useDSL = Deno.env.get('CORESIGNAL_USE_DSL') === 'true';
  const path = useDSL
    ? (Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH') ?? '/v2/employee_base/search/es_dsl/preview').replace(/^\/+/, '')
    : (Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PATH') ?? '/v2/employee_base/search/filter').replace(/^\/+/, '');
  
  const url = `${base}/${path}`;
  
  const logDebug = (Deno.env.get('LOG_LEVEL') === 'debug');
  
  // Log final URL at debug level
  if (logDebug) {
    console.debug('[CORESIGNAL] Final URL:', url);
    console.debug('[CORESIGNAL] Using', useDSL ? 'ES-DSL' : 'REST filters', 'endpoint');
  }
  
  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      // One-click debug probe: Log URL and payload before fetch
      if (logDebug) {
        console.debug('[CORESIGNAL] URL', url);
        console.debug('[CORESIGNAL] Payload', JSON.stringify(request));
      }

      logStep("Calling CoreSignal API", { attempt: retryCount + 1, request });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      // Debug probe: Log status and first 500 chars of body
      if (logDebug) {
        const txt = await response.clone().text();
        console.debug('[CORESIGNAL] Status:', response.status);
        console.debug('[CORESIGNAL] Body (first 500):', txt.slice(0, 500));
      }

      const creditsRemaining = response.headers.get('x-credits-remaining');

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        logStep("Rate limited by provider", { retryAfter, attempt: retryCount + 1 });
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          retryCount++;
          continue;
        }
        throw new Error(`Rate limited by provider. Retry after ${retryAfter}s`);
      }

      if (response.status >= 500) {
        logStep("Provider server error", { status: response.status, attempt: retryCount + 1 });
        
        if (retryCount < maxRetries) {
          const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          retryCount++;
          continue;
        }
        throw new Error(`Provider server error (${response.status})`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorBody: any = {};
        try {
          errorBody = JSON.parse(errorText);
        } catch {
          errorBody = { message: errorText };
        }

        const providerRequestId = errorBody.request_id || errorBody.requestId;

        // Handle 404 - Endpoint not found
        if (response.status === 404) {
          logStep("Provider endpoint not found (404)", { 
            url, 
            providerRequestId,
            errorBody 
          });
          const err = new Error('Search endpoint not found - check CORESIGNAL_PEOPLE_SEARCH_PATH configuration');
          (err as any).code = 'PROVIDER_UNAVAILABLE';
          (err as any).providerRequestId = providerRequestId;
          throw err;
        }

        // Handle 401/403 - Auth failures
        if (response.status === 401 || response.status === 403) {
          const error: any = new Error('Provider authentication failed');
          error.code = "PROVIDER_AUTH_FAILED";
          error.providerRequestId = providerRequestId;
          throw error;
        }

        // Generic error
        throw new Error(`CoreSignal API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const providerRequestId = data.request_id || data.requestId;
      
      logStep("CoreSignal API success", { 
        total: data.total || data.hits?.total?.value || data.hits?.length || 0,
        creditsRemaining,
        providerRequestId
      });

      // Map ES-DSL response format (Base Employee uses hits.hits array)
      const hits = data.hits?.hits || data.hits || data.results || [];
      const total = data.hits?.total?.value || data.total || hits.length;

      // Extract _source from each hit
      const results = hits.map((hit: any) => hit._source || hit);

      return {
        results,
        total,
        creditsRemaining: creditsRemaining ? parseInt(creditsRemaining) : undefined,
        providerRequestId
      };

    } catch (error) {
      lastError = error as Error;
      logStep("CoreSignal API error", { error: lastError.message, attempt: retryCount + 1 });
      
      if (retryCount < maxRetries && !lastError.message.includes('Rate limited')) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        retryCount++;
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("Failed to call CoreSignal API");
}

/**
 * Calculate match score for a candidate from Base Employee schema
 */
function calculateMatchScore(
  candidate: CoreSignalEmployee,
  query: SearchRequest['query'],
  currentTitle?: string
): number {
  let score = 0;

  // Title similarity (40 points) - use extracted current title
  const titleToMatch = currentTitle || candidate.title;
  if (query.titles && titleToMatch) {
    const titleLower = titleToMatch.toLowerCase();
    const matchedTitles = query.titles.filter(t => 
      titleLower.includes(t.toLowerCase()) || t.toLowerCase().includes(titleLower)
    );
    score += (matchedTitles.length / query.titles.length) * 40;
    
    // Boost if current title matches closely
    if (currentTitle && matchedTitles.length > 0) {
      score += 5; // Extra boost for current title match
    }
  } else if (titleToMatch) {
    score += 20; // Has title but no query titles
  }

  // Skills overlap (40 points) - check skills array from nested schema
  if (query.keywords && query.keywords.length > 0) {
    let candidateSkills: string[] = [];
    if (Array.isArray(candidate.skills)) {
      candidateSkills = candidate.skills.map((s: any) => 
        typeof s === 'string' ? s : s.skill || ''
      ).filter(Boolean);
    }

    const candidateText = [
      titleToMatch,
      candidate.company_name,
      candidate.location,
      ...candidateSkills
    ].filter(Boolean).join(' ').toLowerCase();

    const matchedKeywords = query.keywords.filter(k =>
      candidateText.includes(k.toLowerCase())
    );
    score += (matchedKeywords.length / query.keywords.length) * 40;
  } else {
    score += 20; // No keywords to match
  }

  // Location/language fit (20 points)
  let locationLanguageScore = 0;
  
  if (query.locations && candidate.location) {
    const locationLower = candidate.location.toLowerCase();
    const matchedLocations = query.locations.filter(l =>
      locationLower.includes(l.toLowerCase())
    );
    locationLanguageScore += (matchedLocations.length / query.locations.length) * 10;
  } else if (!query.locations) {
    locationLanguageScore += 10;
  }

  // Language matching from nested languages
  if (query.languages && query.languages.length > 0) {
    let candidateLanguages: string[] = [];
    if (Array.isArray(candidate.languages)) {
      candidateLanguages = candidate.languages.map((l: any) => 
        typeof l === 'string' ? l : l.language || ''
      ).filter(Boolean).map(lang => lang.toLowerCase());
    }

    const matchedLanguages = query.languages.filter(queryLang =>
      candidateLanguages.some(candLang => 
        candLang.includes(queryLang.toLowerCase()) || 
        queryLang.toLowerCase().includes(candLang)
      )
    );
    
    locationLanguageScore += (matchedLanguages.length / query.languages.length) * 10;
  } else {
    locationLanguageScore += 10;
  }

  score += locationLanguageScore;

  return Math.min(100, Math.round(score));
}

/**
 * Normalize CoreSignal Base Employee to SearchResult
 */
function normalizeEmployee(employee: CoreSignalEmployee, query: SearchRequest['query']): SearchResult {
  // Extract current title from experience array
  let currentTitle: string | undefined;
  if (Array.isArray(employee.experience)) {
    const currentExp = employee.experience.find((exp: any) => exp.is_current === 1);
    if (currentExp) {
      currentTitle = currentExp.title;
    } else if (employee.experience.length > 0) {
      // Fallback to highest order_in_profile or first entry
      const sorted = [...employee.experience].sort((a: any, b: any) => 
        (a.order_in_profile || 999) - (b.order_in_profile || 999)
      );
      currentTitle = sorted[0]?.title;
    }
  }

  return {
    provider_code: "coresignal",
    provider_ref: employee.id,
    name: employee.full_name || employee.name,
    title: currentTitle || employee.title,
    company: employee.company_name,
    location: employee.location,
    profileUrl: employee.profile_url || employee.linkedin_url,
    lastUpdatedAt: employee.updated_at || employee.last_updated,
    match: calculateMatchScore(employee, query, currentTitle)
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Get origin for consistent CORS headers
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  // Generate request ID for tracking
  const requestId = generateRequestId();
  
  // Parse URL for query parameters
  const url = new URL(req.url);
  const selfTest = url.searchParams.get('self_test') === '1';

  try {
    logStep("Search request received", { requestId, selfTest });

    // Parse JSON body with error handling
    let body: SearchRequest;
    try {
      body = await req.json();
    } catch {
      logStep("Invalid JSON", { requestId });
      return new Response(
        JSON.stringify({ 
          code: 'BAD_REQUEST',
          message: 'Request body must be valid JSON',
          requestId
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep("Missing auth header", { requestId });
      return new Response(
        JSON.stringify({ 
          code: 'UNAUTHORIZED',
          message: 'Missing authorization header',
          requestId
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Get user from session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      logStep("Auth validation failed", { requestId, error: authError });
      return new Response(
        JSON.stringify({ 
          code: 'UNAUTHORIZED',
          message: 'Invalid session',
          requestId
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // ============================================================
    // SELF-TEST MODE (DEV ONLY)
    // ============================================================
    if (selfTest) {
      const isDev = Deno.env.get('ENVIRONMENT') === 'development' || 
                    Deno.env.get('ENV') === 'dev' ||
                    !Deno.env.get('ENVIRONMENT'); // Local dev has no ENVIRONMENT set
      
      if (!isDev) {
        return new Response(
          JSON.stringify({ 
            code: 'FORBIDDEN',
            message: 'Self-test mode is only available in development',
            requestId
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }

      logStep("Self-test mode activated", { requestId });

      const coreSignalApiKey = Deno.env.get('CORESIGNAL_API_KEY');
      if (!coreSignalApiKey) {
        return new Response(
          JSON.stringify({ 
            code: 'PROVIDER_UNAVAILABLE',
            message: 'CoreSignal API key not configured',
            requestId
          }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }

      // Minimal REST payload
      const testPayload = {
        title: "engineer",
        page: 1,
        page_size: 1
      };

      const logDebug = (Deno.env.get('LOG_LEVEL') === 'debug');
      
      try {
        // Build URL (always use REST for self-test)
        const base = (Deno.env.get('CORESIGNAL_BASE_URL') ?? 'https://api.coresignal.com').replace(/\/+$/, '');
        const path = (Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PATH') ?? '/v2/employee_base/search/filter').replace(/^\/+/, '');
        const testUrl = `${base}/${path}`;

        if (logDebug) {
          console.debug('[CORESIGNAL] Self-test URL:', testUrl);
          console.debug('[CORESIGNAL] Self-test payload:', JSON.stringify(testPayload));
        }

        logStep("Sending self-test request", { requestId, url: testUrl, payload: testPayload });

        const response = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${coreSignalApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPayload)
        });

        const responseText = await response.text();
        
        if (logDebug) {
          console.debug('[CORESIGNAL] Self-test status:', response.status);
          console.debug('[CORESIGNAL] Self-test body (first 500):', responseText.slice(0, 500));
        }

        let hitCount = 0;
        let parsedResponse: any = {};
        
        try {
          parsedResponse = JSON.parse(responseText);
          // Try different response formats
          hitCount = parsedResponse.total || 
                     parsedResponse.hits?.total?.value || 
                     parsedResponse.hits?.length || 
                     parsedResponse.results?.length || 
                     0;
        } catch {
          // Non-JSON response
        }

        logStep("Self-test completed", { 
          requestId, 
          status: response.status, 
          hitCount,
          creditsConsumed: 0 
        });

        return new Response(
          JSON.stringify({
            self_test: true,
            provider_status: response.status,
            provider_ok: response.ok,
            hit_count: hitCount,
            credits_consumed: 0,
            url: testUrl,
            payload: testPayload,
            requestId,
            note: "Self-test mode - no credits consumed"
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
        );

      } catch (error: any) {
        logStep("Self-test failed", { requestId, error: error.message });
        
        return new Response(
          JSON.stringify({
            self_test: true,
            error: error.message,
            credits_consumed: 0,
            requestId
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
        );
      }
    }

    // ============================================================
    // NORMAL FLOW
    // ============================================================

    // Validate request input
    const validation = validateRequest(body, requestId);
    
    if (!validation.valid) {
      logStep("Validation failed", { requestId, error: validation.error });
      return new Response(
        JSON.stringify({ 
          code: 'BAD_REQUEST',
          message: validation.error,
          requestId
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Use normalized data from validation
    const normalizedBody = validation.normalized || body;
    const { organization_id, job_id, query, pagination } = normalizedBody;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;

    logStep("Request validated", { requestId, organization_id, job_id, page, pageSize });

    // Check organization permission
    const permissionCheck = await checkOrgPermission(supabaseClient, user.id, organization_id);
    if (!permissionCheck.allowed) {
      logStep("Permission denied", { requestId, userId: user.id, organization_id });
      return new Response(
        JSON.stringify({ 
          code: 'FORBIDDEN',
          message: permissionCheck.error,
          requestId
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey(organization_id, job_id, query, page);
    logStep("Cache key generated", { requestId, cacheKey });

    // Check cache
    const cacheResult = await checkCache(supabaseClient, cacheKey);
    if (cacheResult.hit && cacheResult.data) {
      logStep("Returning cached results", { requestId });
      
      const response: SearchResponse = {
        total: cacheResult.data.total,
        items: cacheResult.data.items,
        cache: {
          hit: true,
          ttl_seconds: cacheResult.ttl_seconds
        },
        credits: {
          charged: 0
        }
      };

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Create service role client for credit operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get CoreSignal API key
    const coreSignalApiKey = Deno.env.get('CORESIGNAL_API_KEY');
    if (!coreSignalApiKey) {
      logStep("CoreSignal API key not configured", { requestId });
      return new Response(
        JSON.stringify({ 
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Search provider not configured',
          requestId
        }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Build request payload based on endpoint type
    const useDSL = Deno.env.get('CORESIGNAL_USE_DSL') === 'true';
    const requestPayload = useDSL
      ? buildCoreSignalRequest(query, { page, pageSize })
      : buildCoreSignalFilterPayload(query, { page, pageSize });
    
    logStep("Built request payload", { requestId, useDSL, payload: requestPayload });
    
    let searchResults: CoreSignalEmployee[];
    let total: number;
    let creditsRemaining: number | undefined;
    let providerRequestId: string | undefined;
    let creditsCharged = 0;

    try {
      const apiResult = await callCoreSignalAPI(coreSignalApiKey, requestPayload, requestId);
      searchResults = apiResult.results;
      total = apiResult.total;
      creditsRemaining = apiResult.creditsRemaining;
      providerRequestId = apiResult.providerRequestId;

      // ✅ ONLY consume credits on successful 200 response
      logStep("Attempting to consume search credit after success", { requestId });
      const { data: consumed, error: creditError } = await serviceClient.rpc('consume_sourcing_credits', {
        org_id: organization_id,
        credit_type: 'search',
        amount: 1
      });

      if (creditError) {
        logStep("Credit consumption error after success", { requestId, error: creditError });
        // Continue anyway - we got results, just log the credit issue
        creditsCharged = 1; // Mark as charged even if RPC failed
      } else if (consumed) {
        creditsCharged = 1;
        logStep("Credit consumed successfully after API success", { requestId });
      }

    } catch (error: any) {
      const errorCode = error.code || 'PROVIDER_UNAVAILABLE';
      const errorMessage = error.message || 'Unknown provider error';
      const errorProviderRequestId = error.providerRequestId;

      logStep("Provider call failed", { 
        requestId, 
        error: errorMessage, 
        code: errorCode,
        providerRequestId: errorProviderRequestId
      });
      
      // Log failed event (0 credits used)
      await serviceClient.from('sourcing_events').insert({
        organization_id,
        job_id: job_id || null,
        event_type: 'search',
        provider: 'coresignal',
        credits_used: 0,
        credit_type: 'search',
        query_params: query,
        results_count: 0,
        error_message: errorMessage,
        performed_by: user.id,
        metadata: { 
          requestId,
          providerRequestId: errorProviderRequestId,
          errorCode
        }
      });

      return new Response(
        JSON.stringify({ 
          code: errorCode,
          message: errorMessage,
          requestId,
          providerRequestId: errorProviderRequestId,
          credits_used: 0
        }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Normalize and score results
    const normalizedResults: SearchResult[] = searchResults.map(emp => normalizeEmployee(emp, query));

    // 13) Debug diagnostics for zero results
    const logDebug = (Deno.env.get('LOG_LEVEL') === 'debug');
    if (logDebug && normalizedResults.length === 0) {
      console.debug('[SOURCING-SEARCH] Zero results - running diagnostic probe');
      
      // Only run probes for DSL mode (REST mode doesn't support match_all)
      if (useDSL) {
        try {
          // Probe 1: match_all to confirm index access
          const probeMatchAll = await callCoreSignalAPI(
            coreSignalApiKey,
            { query: { match_all: {} }, size: 1 },
            `${requestId}-probe-matchall`
          );
          console.debug('[SOURCING-SEARCH] Probe match_all returned:', probeMatchAll.total, 'total records');

          // Probe 2: Simple nested title search
          const probeTitle = await callCoreSignalAPI(
            coreSignalApiKey,
            {
              query: {
                bool: {
                  must: [{
                    nested: {
                      path: "experience",
                      query: {
                        bool: {
                          must: [
                            { match_phrase: { "experience.title": "engineer" } },
                            { term: { "experience.is_current": 1 } }
                          ]
                        }
                      }
                    }
                  }]
                }
              },
              size: 1
            },
            `${requestId}-probe-title`
          );
          console.debug('[SOURCING-SEARCH] Probe title=engineer returned:', probeTitle.total, 'records');
        } catch (probeError) {
          console.debug('[SOURCING-SEARCH] Probe failed:', probeError);
        }
      } else {
        console.debug('[SOURCING-SEARCH] Skipping DSL probes in REST mode');
      }
    }

    // Store in external_candidate_matches with cache key
    if (normalizedResults.length > 0) {
      const matchRecords = normalizedResults.map(result => ({
        organization_id,
        job_id: job_id || null,
        provider: 'coresignal',
        provider_id: result.provider_ref,
        candidate_name: result.name || 'Unknown',
        current_title: result.title,
        current_company: result.company,
        location_city: result.location?.split(',')[0]?.trim(),
        location_country: result.location?.split(',').pop()?.trim(),
        linkedin_url: result.profileUrl,
        match_score: result.match,
        raw_data: {
          cache_key: cacheKey,
          last_updated_at: result.lastUpdatedAt
        },
        is_collected: false
      }));

      await serviceClient.from('external_candidate_matches')
        .upsert(matchRecords, {
          onConflict: 'organization_id,provider,provider_id',
          ignoreDuplicates: false
        });
    }

    // Log successful event
    await serviceClient.from('sourcing_events').insert({
      organization_id,
      job_id: job_id || null,
      event_type: 'search',
      provider: 'coresignal',
      credits_used: creditsCharged,
      credit_type: 'search',
      query_params: query,
      results_count: normalizedResults.length,
      performed_by: user.id,
      metadata: { 
        requestId,
        providerRequestId
      }
    });

    logStep("Search completed successfully", { 
      requestId,
      results: normalizedResults.length,
      total 
    });

    // Build response
    const response: SearchResponse = {
      total,
      items: normalizedResults,
      cache: {
        hit: false,
        ttl_seconds: 15 * 60
      },
      credits: {
        charged: creditsCharged,
        remaining: creditsRemaining
      }
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );

  } catch (error) {
    logStep("Unexpected error", { requestId, error: (error as Error).message });
    
    return new Response(
      JSON.stringify({ 
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId,
        details: (error as Error).message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
});
