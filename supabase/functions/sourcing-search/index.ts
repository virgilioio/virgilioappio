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
  name?: string;
  title?: string;
  company_name?: string;
  location?: string;
  linkedin_url?: string;
  last_updated?: string;
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
 * Build CoreSignal ES-DSL API request from search query
 */
function buildCoreSignalRequest(query: SearchRequest['query'], pagination: { page: number; pageSize: number }) {
  const must: any[] = [];
  const should: any[] = [];
  const filter: any[] = [];

  // Boolean query string (if present)
  if (query.boolean?.trim()) {
    must.push({ query_string: { query: query.boolean.trim() } });
  }

  // Title as match_phrase (use first title or combine)
  if (query.titles && query.titles.length > 0) {
    must.push({ match_phrase: { job_title: query.titles[0].trim() } });
  }

  // Skills (keywords) as terms in should for boosting
  const skills = query.keywords || [];
  if (Array.isArray(skills) && skills.length > 0) {
    should.push({ terms: { skills: skills.slice(0, 15) } });
  }

  // Locations as terms in filter
  if (Array.isArray(query.locations) && query.locations.length > 0) {
    filter.push({ terms: { locations: query.locations.slice(0, 10) } });
  }

  // Email requirement
  if (query.require_email || query.has_email === 'only') {
    filter.push({ term: { has_email: true } });
  }

  // Phone requirement
  if (query.require_phone || query.has_phone === 'only') {
    filter.push({ term: { has_phone: true } });
  }

  // Updated within days
  if (typeof query.updated_within_days === 'number') {
    filter.push({ range: { updated_at: { gte: `now-${query.updated_within_days}d` } } });
  }

  // Build query object
  const queryObj = must.length || should.length || filter.length
    ? { bool: { must, should, filter } }
    : { match_all: {} };

  // Calculate pagination
  const pageSize = Math.min(pagination.pageSize ?? 25, 100);
  const from = Math.max(((pagination.page ?? 1) - 1), 0) * pageSize;

  // Sanitize: remove empty arrays from must/should/filter
  const sanitizedQuery: any = {};
  if (queryObj.bool) {
    const boolObj: any = {};
    if (queryObj.bool.must && queryObj.bool.must.length > 0) boolObj.must = queryObj.bool.must;
    if (queryObj.bool.should && queryObj.bool.should.length > 0) boolObj.should = queryObj.bool.should;
    if (queryObj.bool.filter && queryObj.bool.filter.length > 0) boolObj.filter = queryObj.bool.filter;
    
    // Only set query if we have clauses
    if (Object.keys(boolObj).length > 0) {
      sanitizedQuery.query = { bool: boolObj };
    } else {
      sanitizedQuery.query = { match_all: {} };
    }
  } else {
    sanitizedQuery.query = queryObj;
  }

  sanitizedQuery.size = pageSize;
  sanitizedQuery.from = from;

  return sanitizedQuery;
}

/**
 * Build CoreSignal People Search URL
 */
function buildPeopleSearchUrl({ baseUrl, path }: { baseUrl: string; path: string }): string {
  // Remove trailing slash from baseUrl and leading slash from path if present
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${cleanBase}/${cleanPath}`;
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
  // Read URL configuration from environment
  const BASE = Deno.env.get("CORESIGNAL_BASE_URL") ?? "https://api.coresignal.com";
  const PATH = Deno.env.get("CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH") ?? "/v2/employee_base/search/es_dsl/preview";
  const url = buildPeopleSearchUrl({ baseUrl: BASE, path: PATH });
  
  // Debug log ES-DSL payload
  if (Deno.env.get('LOG_LEVEL') === 'debug') {
    console.debug('[SOURCING-SEARCH] ES-DSL Payload:', JSON.stringify(request, null, 2));
  }
  
  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      logStep("Calling CoreSignal API", { attempt: retryCount + 1, request });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

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
          const error: any = new Error('Endpoint not found (check path)');
          error.code = "PROVIDER_UNAVAILABLE";
          error.providerRequestId = providerRequestId;
          throw error;
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
        total: data.total || data.hits?.length || 0,
        creditsRemaining,
        providerRequestId
      });

      // Map ES-DSL response format (hits array)
      const results = data.hits || data.results || [];

      return {
        results,
        total: data.total || results.length,
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
 * Calculate match score for a candidate
 */
function calculateMatchScore(
  candidate: CoreSignalEmployee,
  query: SearchRequest['query']
): number {
  let score = 0;

  // Title similarity (40 points)
  if (query.titles && candidate.title) {
    const titleLower = candidate.title.toLowerCase();
    const matchedTitles = query.titles.filter(t => 
      titleLower.includes(t.toLowerCase()) || t.toLowerCase().includes(titleLower)
    );
    score += (matchedTitles.length / query.titles.length) * 40;
  } else if (candidate.title) {
    score += 20; // Has title but no query titles
  }

  // Keyword overlap (40 points)
  if (query.keywords && query.keywords.length > 0) {
    const candidateText = [
      candidate.title,
      candidate.company_name,
      candidate.location
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

  // Language is harder to match from basic employee data, give default points
  if (!query.languages || query.languages.length === 0) {
    locationLanguageScore += 10;
  } else {
    locationLanguageScore += 5; // Partial credit if languages specified
  }

  score += locationLanguageScore;

  return Math.min(100, Math.round(score));
}

/**
 * Normalize CoreSignal employee to SearchResult
 */
function normalizeEmployee(employee: CoreSignalEmployee, query: SearchRequest['query']): SearchResult {
  return {
    provider_code: "coresignal",
    provider_ref: employee.id,
    name: employee.name,
    title: employee.title,
    company: employee.company_name,
    location: employee.location,
    profileUrl: employee.linkedin_url,
    lastUpdatedAt: employee.last_updated,
    match: calculateMatchScore(employee, query)
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

  try {
    logStep("Search request received", { requestId });

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

    // Build and call CoreSignal API
    const coreSignalRequest = buildCoreSignalRequest(query, { page, pageSize });
    
    let searchResults: CoreSignalEmployee[];
    let total: number;
    let creditsRemaining: number | undefined;
    let providerRequestId: string | undefined;
    let creditsCharged = 0;

    try {
      const apiResult = await callCoreSignalAPI(coreSignalApiKey, coreSignalRequest, requestId);
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
