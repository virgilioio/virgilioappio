import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";

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
 * Validate search request input
 */
function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body.organization_id) {
    return { valid: false, error: "organization_id is required" };
  }

  if (!body.query || typeof body.query !== 'object') {
    return { valid: false, error: "query object is required" };
  }

  const { pagination } = body;
  if (pagination) {
    if (pagination.page < 1) {
      return { valid: false, error: "pagination.page must be >= 1" };
    }
    if (pagination.pageSize < 1 || pagination.pageSize > 100) {
      return { valid: false, error: "pagination.pageSize must be between 1 and 100" };
    }
  }

  return { valid: true };
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
 * Build CoreSignal API request from search query
 */
function buildCoreSignalRequest(query: SearchRequest['query'], pagination: { page: number; pageSize: number }) {
  const filters: any = {};

  if (query.titles && query.titles.length > 0) {
    filters.title = query.titles.join(' OR ');
  }

  if (query.keywords && query.keywords.length > 0) {
    filters.keywords = query.keywords.join(' ');
  }

  if (query.locations && query.locations.length > 0) {
    filters.location = query.locations.join(' OR ');
  }

  if (query.languages && query.languages.length > 0) {
    filters.languages = query.languages;
  }

  if (query.seniority && query.seniority.length > 0) {
    filters.seniority = query.seniority;
  }

  if (query.has_email === 'only') {
    filters.has_email = true;
  }

  if (query.has_phone === 'only') {
    filters.has_phone = true;
  }

  if (query.updated_within_days) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - query.updated_within_days);
    filters.updated_since = daysAgo.toISOString();
  } else {
    // Default to 365 days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - 365);
    filters.updated_since = daysAgo.toISOString();
  }

  return {
    filters,
    page: pagination.page,
    page_size: pagination.pageSize,
    boolean_query: query.boolean
  };
}

/**
 * Call CoreSignal API with retry logic
 */
async function callCoreSignalAPI(
  apiKey: string,
  request: any,
  maxRetries = 2
): Promise<{ results: CoreSignalEmployee[]; total: number; creditsRemaining?: number }> {
  const baseUrl = "https://api.coresignal.com/v1/professional-network/employee/search";
  
  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      logStep("Calling CoreSignal API", { attempt: retryCount + 1, request });

      const response = await fetch(baseUrl, {
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
        throw new Error(`CoreSignal API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      logStep("CoreSignal API success", { 
        total: data.total || data.results?.length || 0,
        creditsRemaining 
      });

      return {
        results: data.results || [],
        total: data.total || data.results?.length || 0,
        creditsRemaining: creditsRemaining ? parseInt(creditsRemaining) : undefined
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

  try {
    logStep("Search request received");

    // Parse JSON body with error handling
    let body: SearchRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'invalid_json', message: 'Request body must be valid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Missing authorization header' }),
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
      logStep("Auth validation failed", { error: authError });
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid session' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Validate request
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    const { organization_id, job_id, query, pagination } = body;
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 25;

    logStep("Request validated", { organization_id, job_id, page, pageSize });

    // Check organization permission
    const permissionCheck = await checkOrgPermission(supabaseClient, user.id, organization_id);
    if (!permissionCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'forbidden', message: permissionCheck.error }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey(organization_id, job_id, query, page);
    logStep("Cache key generated", { cacheKey });

    // Check cache
    const cacheResult = await checkCache(supabaseClient, cacheKey);
    if (cacheResult.hit && cacheResult.data) {
      logStep("Returning cached results");
      
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

    // Create service role client for credit consumption
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Consume search credit
    logStep("Attempting to consume search credit");
    const { data: consumed, error: creditError } = await serviceClient.rpc('consume_sourcing_credits', {
      org_id: organization_id,
      credit_type: 'search',
      amount: 1
    });

    if (creditError) {
      logStep("Credit consumption error", { error: creditError });
      return new Response(
        JSON.stringify({ error: 'internal_error', message: 'Failed to process credits' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    if (!consumed) {
      logStep("Insufficient credits");
      return new Response(
        JSON.stringify({ 
          error: 'CREDITS_EXHAUSTED', 
          message: 'No search credits remaining. Contact your administrator to refill credits.' 
        }),
        { status: 402, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    logStep("Credit consumed successfully");

    // Get CoreSignal API key
    const coreSignalApiKey = Deno.env.get('CORESIGNAL_API_KEY');
    if (!coreSignalApiKey) {
      logStep("CoreSignal API key not configured");
      return new Response(
        JSON.stringify({ error: 'provider_unavailable', message: 'Search provider not configured' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Build and call CoreSignal API
    const coreSignalRequest = buildCoreSignalRequest(query, { page, pageSize });
    
    let searchResults: CoreSignalEmployee[];
    let total: number;
    let creditsRemaining: number | undefined;

    try {
      const apiResult = await callCoreSignalAPI(coreSignalApiKey, coreSignalRequest);
      searchResults = apiResult.results;
      total = apiResult.total;
      creditsRemaining = apiResult.creditsRemaining;
    } catch (error) {
      logStep("Provider call failed", { error: (error as Error).message });
      
      // Log failed event
      await serviceClient.from('sourcing_events').insert({
        organization_id,
        job_id: job_id || null,
        event_type: 'search',
        provider: 'coresignal',
        credits_used: 1,
        credit_type: 'search',
        query_params: query,
        results_count: 0,
        error_message: (error as Error).message,
        performed_by: user.id
      });

      return new Response(
        JSON.stringify({ 
          error: 'provider_unavailable', 
          message: `Search provider error: ${(error as Error).message}` 
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
      credits_used: 1,
      credit_type: 'search',
      query_params: query,
      results_count: normalizedResults.length,
      performed_by: user.id
    });

    logStep("Search completed successfully", { 
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
        charged: 1,
        remaining: creditsRemaining
      }
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );

  } catch (error) {
    logStep("Unexpected error", { error: (error as Error).message });
    
    return new Response(
      JSON.stringify({ 
        error: 'internal_error', 
        message: 'An unexpected error occurred',
        details: (error as Error).message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
});
