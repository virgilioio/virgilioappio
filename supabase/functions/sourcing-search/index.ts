import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PDL_LIMIT_DEFAULT = 5;
const PDL_LIMIT_MAX = 10;
const CACHE_TTL_HOURS = 24;

interface SearchRequest {
  sourcing_project_id: string;
  limit?: number;       // Apollo limit (default 300)
  pdl_limit?: number;   // PDL limit (default 5, max 10)
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);
  const authHeader = req.headers.get('Authorization');

  try {
    const { sourcing_project_id, limit = 300, pdl_limit: rawPdlLimit }: SearchRequest = await req.json();

    if (!sourcing_project_id) {
      throw new Error('sourcing_project_id is required');
    }

    // Enforce PDL limit
    const pdlLimit = Math.min(Math.max(rawPdlLimit || PDL_LIMIT_DEFAULT, 1), PDL_LIMIT_MAX);

    console.log(`🚀 Sourcing search: project=${sourcing_project_id}, apollo_limit=${limit}, pdl_limit=${pdlLimit}`);

    // Fetch project with cache timestamps
    const { data: project, error: projectError } = await supabase
      .from('sourcing_projects')
      .select('id, organization_id, search_criteria, sourcing_cache_expires_at, pdl_cache_expires_at, organizations!inner(tenant_id)')
      .eq('id', sourcing_project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    const projectTenantId = (project as any).organizations?.tenant_id;
    }

    const criteria = project.search_criteria;
    if (!criteria?.title_keywords?.length) {
      return new Response(JSON.stringify({
        candidates: [],
        source_breakdown: { pdl: 0, apollo: 0, full_data: 0, preview_only: 0 },
        search_metadata: {},
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const now = new Date();

    // ── PDL: check cache or fetch ──
    let pdlCandidates: any[] = [];
    let pdlCacheValid = project.pdl_cache_expires_at && new Date(project.pdl_cache_expires_at) > now;

    if (pdlCacheValid) {
      console.log('✅ PDL cache timestamp valid — checking for cached rows');
      const { data: cached } = await supabase
        .from('sourcing_preview_candidates')
        .select('*')
        .eq('sourcing_project_id', sourcing_project_id)
        .eq('source', 'pdl');

      if (cached && cached.length > 0) {
        pdlCandidates = cached.map(mapCachedPdlCandidate);
        console.log(`✅ PDL cache hit — loaded ${pdlCandidates.length} cached candidates`);
      } else {
        // Cache timestamp exists but no rows — treat as cache miss
        console.log('⚠️ PDL cache timestamp set but 0 cached rows — treating as cache miss');
        pdlCacheValid = false;
      }
    }

    if (!pdlCacheValid) {
      console.log('🔄 PDL cache miss — calling search-pdl-candidates');
      try {
        const { data: pdlResult, error: pdlError } = await supabase.functions.invoke('search-pdl-candidates', {
          body: { criteria, limit: pdlLimit },
          headers: authHeader ? { Authorization: authHeader } : undefined,
        });

        if (pdlError) {
          console.warn('⚠️ PDL search failed:', pdlError);
        } else {
          pdlCandidates = pdlResult?.candidates || [];
          console.log(`✅ PDL returned ${pdlCandidates.length} candidates (strategy: ${pdlResult?.winning_strategy || 'unknown'})`);

          // Only cache if we got actual results
          if (pdlCandidates.length > 0) {
            // Clear old PDL cache for this project
            await supabase
              .from('sourcing_preview_candidates')
              .delete()
              .eq('sourcing_project_id', sourcing_project_id)
              .eq('source', 'pdl');

            // Insert new PDL results
            const pdlRows = pdlCandidates.map((c: any) => ({
              sourcing_project_id,
              source: 'pdl',
              pdl_id: c.pdl_id,
              full_name: c.full_name || c.candidate_name,
              headline: c.headline,
              current_company: c.current_company,
              current_title: c.current_title,
              linkedin_url: c.linkedin_url,
              summary: c.summary,
              skills: c.skills,
              experience: c.experience,
              education: c.education,
              certifications: c.certifications,
              emails: c.emails,
              phones: c.phones,
              github_url: c.github_url,
              twitter_url: c.twitter_url,
              website_url: c.website_url,
              job_title_levels: c.job_title_levels,
              location_city: c.location_city,
              location_state: c.location_state,
              location_country: c.location_country,
              has_email: c.has_email ?? false,
              has_phone: c.has_phone ?? false,
              has_location: c.has_location ?? false,
              match_score: c.match_score || 100,
            }));

            const { error: insertError } = await supabase
              .from('sourcing_preview_candidates')
              .insert(pdlRows);

            if (insertError) {
              console.warn('⚠️ Failed to cache PDL results:', insertError);
            }

            // Only set cache expiry when we have actual results
            const pdlCacheExpiry = new Date();
            pdlCacheExpiry.setHours(pdlCacheExpiry.getHours() + CACHE_TTL_HOURS);

            await supabase
              .from('sourcing_projects')
              .update({
                pdl_cache_expires_at: pdlCacheExpiry.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sourcing_project_id);
          } else {
            console.log('ℹ️ PDL returned 0 candidates — NOT caching empty result');
          }
        }
      } catch (pdlErr: any) {
        console.warn('⚠️ PDL search error (non-fatal):', pdlErr.message);
      }
    }

    // ── Apollo: delegate to search-apollo-candidates (handles its own cache) ──
    let apolloCandidates: any[] = [];
    let apolloSearchMetadata: any = {};

    try {
      console.log('🔄 Calling search-apollo-candidates');
      const { data: apolloResult, error: apolloError } = await supabase.functions.invoke('search-apollo-candidates', {
        body: {
          project_id: sourcing_project_id,
          criteria,
          limit: Math.min(limit, 300),
          max_results: Math.min(limit, 300),
          organization_id: project.organization_id,
        },
        headers: authHeader ? { Authorization: authHeader } : undefined,
      });

      if (apolloError) {
        console.warn('⚠️ Apollo search failed:', apolloError);
      } else {
        apolloCandidates = (apolloResult?.candidates || []).map((c: any) => ({
          ...c,
          source: 'apollo',
          is_preview: true,
          needs_enrichment: true,
        }));
        apolloSearchMetadata = apolloResult?.keyword_stats ? { keyword_stats: apolloResult.keyword_stats } : {};
        console.log(`✅ Apollo returned ${apolloCandidates.length} candidates (cached: ${apolloResult?.cached || false})`);
      }
    } catch (apolloErr: any) {
      console.warn('⚠️ Apollo search error (non-fatal):', apolloErr.message);
    }

    // ── Merge & deduplicate ──
    // PDL candidates first (full data), then Apollo (preview)
    // Deduplicate by LinkedIn URL when both sources have it
    const pdlLinkedInUrls = new Set(
      pdlCandidates
        .filter((c: any) => c.linkedin_url)
        .map((c: any) => normalizeLinkedInUrl(c.linkedin_url))
    );

    const dedupedApollo = apolloCandidates.filter((c: any) => {
      if (!c.linkedin_url) return true; // Keep if no LinkedIn URL to dedup on
      return !pdlLinkedInUrls.has(normalizeLinkedInUrl(c.linkedin_url));
    });

    const deduplicated = apolloCandidates.length - dedupedApollo.length;

    // ── Cross-reference Apollo results with already-collected candidates ──
    // SECURITY: scope by tenant_id to prevent cross-tenant data leakage
    const apolloIds = dedupedApollo
      .map((c: any) => c.apollo_id)
      .filter(Boolean);

    let sameTenantMap = new Map<string, any>();
    let crossTenantMap = new Map<string, any>();

    if (apolloIds.length > 0) {
      const { data: collected } = await supabase
        .from('candidates')
        .select('id, apollo_id, tenant_id, candidate_name, email, phone, linkedin_url, location_city, location_state, location_country, company_current, role_current')
        .in('apollo_id', apolloIds)
        .not('apollo_collected_at', 'is', null);

      if (collected) {
        for (const c of collected) {
          if (projectTenantId && c.tenant_id === projectTenantId) {
            sameTenantMap.set(c.apollo_id, c);
          } else {
            // Cross-tenant: only keep if not already matched by same-tenant
            if (!sameTenantMap.has(c.apollo_id)) {
              crossTenantMap.set(c.apollo_id, c);
            }
          }
        }
        console.log(`✅ Collected matches: ${sameTenantMap.size} same-tenant (Internal), ${crossTenantMap.size} cross-tenant (Gio)`);
      }
    }

    const enrichedApollo = dedupedApollo.map((c: any) => {
      const sameMatch = c.apollo_id ? sameTenantMap.get(c.apollo_id) : null;
      if (sameMatch) {
        // Same-tenant → Internal: full candidate_id access
        return {
          ...c,
          candidate_id: sameMatch.id,
          candidate_name: sameMatch.candidate_name,
          full_name: sameMatch.candidate_name,
          email: sameMatch.email,
          phone: sameMatch.phone,
          linkedin_url: sameMatch.linkedin_url || c.linkedin_url,
          location_city: sameMatch.location_city,
          location_state: sameMatch.location_state,
          location_country: sameMatch.location_country,
          current_company: sameMatch.company_current || c.current_company,
          current_role: sameMatch.role_current || c.current_role,
          is_preview: false,
          needs_enrichment: false,
        };
      }

      const crossMatch = c.apollo_id ? crossTenantMap.get(c.apollo_id) : null;
      if (crossMatch) {
        // Cross-tenant → Gio: enriched display data but NO candidate_id
        return {
          ...c,
          is_gio_sourced: true,
          candidate_id: null, // SECURITY: never expose cross-tenant DB IDs
          candidate_name: crossMatch.candidate_name,
          full_name: crossMatch.candidate_name,
          linkedin_url: crossMatch.linkedin_url || c.linkedin_url,
          location_city: crossMatch.location_city,
          location_state: crossMatch.location_state,
          location_country: crossMatch.location_country,
          current_company: crossMatch.company_current || c.current_company,
          current_role: crossMatch.role_current || c.current_role,
          is_preview: true,
          needs_enrichment: true,
        };
      }

      return c;
    });

    const allCandidates = [...pdlCandidates, ...enrichedApollo];

    const sourceBreakdown = {
      pdl: pdlCandidates.length,
      apollo: dedupedApollo.length,
      full_data: pdlCandidates.length,
      preview_only: dedupedApollo.length,
      deduplicated,
    };

    console.log(`📊 Final: ${allCandidates.length} candidates (PDL: ${sourceBreakdown.pdl}, Apollo: ${sourceBreakdown.apollo}, deduped: ${deduplicated})`);

    return new Response(JSON.stringify({
      candidates: allCandidates,
      source_breakdown: sourceBreakdown,
      search_metadata: {
        ...apolloSearchMetadata,
        pdl_cached: pdlCacheValid,
        pdl_limit: pdlLimit,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error: any) {
    console.error('❌ Sourcing search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});

/**
 * Map a cached PDL row back to the MatchedCandidate shape
 */
function mapCachedPdlCandidate(row: any): any {
  return {
    pdl_id: row.pdl_id,
    full_name: row.full_name,
    candidate_name: row.full_name,
    headline: row.headline,
    current_title: row.current_title,
    current_company: row.current_company,
    linkedin_url: row.linkedin_url,
    summary: row.summary,
    skills: row.skills || [],
    experience: row.experience || [],
    education: row.education || [],
    certifications: row.certifications || [],
    emails: row.emails || [],
    phones: row.phones || [],
    github_url: row.github_url,
    twitter_url: row.twitter_url,
    website_url: row.website_url,
    job_title_levels: row.job_title_levels || [],
    location_city: row.location_city,
    location_state: row.location_state,
    location_country: row.location_country,
    has_email: row.has_email ?? false,
    has_phone: row.has_phone ?? false,
    has_location: row.has_location ?? false,
    match_score: row.match_score || 100,
    match_tier: 'good',
    source: 'pdl',
    is_preview: false,
    needs_enrichment: false,
  };
}

/**
 * Normalize LinkedIn URL for deduplication
 */
function normalizeLinkedInUrl(url: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .replace(/^linkedin\.com\/in\//, '');
}
