import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";
import { callerFromRequest, isServiceCall } from "../_shared/caller.ts";
import { matchContext, searchMatch, previewChecks, allSkills, regionFor } from "../_shared/findCriteria.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PDL_LIMIT_DEFAULT = 5;
const PDL_LIMIT_MAX = 10;
const CACHE_TTL_HOURS = 24;

interface SearchRequest {
  sourcing_project_id: string;
  limit?: number;       // Apollo limit (default 2000)
  pdl_limit?: number;   // PDL limit (default 5, max 10)
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);
  const authHeader = req.headers.get('Authorization');

  try {
    const { sourcing_project_id, limit = 2000, pdl_limit: rawPdlLimit }: SearchRequest = await req.json();

    if (!sourcing_project_id) {
      throw new Error('sourcing_project_id is required');
    }

    // Enforce PDL limit
    const pdlLimit = Math.min(Math.max(rawPdlLimit || PDL_LIMIT_DEFAULT, 1), PDL_LIMIT_MAX);

    console.log(`🚀 Sourcing search: project=${sourcing_project_id}, apollo_limit=${limit}, pdl_limit=${pdlLimit}`);

    // Fetch project with cache timestamps
    const { data: project, error: projectError } = await supabase
      .from('sourcing_projects')
      .select('id, organization_id, job_id, search_criteria, sourcing_cache_expires_at, pdl_cache_expires_at, organizations!inner(tenant_id)')
      .eq('id', sourcing_project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    const projectTenantId = (project as any).organizations?.tenant_id;

    // Only members of the project's workspace may run its search (2026-10-11).
    const caller = isServiceCall(req) ? null : await callerFromRequest(req, supabase);
    if (!isServiceCall(req) && (!caller || !caller.memberOf(projectTenantId))) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const criteria = project.search_criteria || {};

    // Defensive: if title_keywords are missing but we have a linked job,
    // derive them from the job so projects created with thin payloads
    // still return candidates instead of silently exiting with 0.
    if ((!criteria.title_keywords || criteria.title_keywords.length === 0) && project.job_id) {
      const { data: jobRow } = await supabase
        .from('jobs')
        .select('title, internal_title')
        .eq('id', project.job_id)
        .maybeSingle();
      const derived = [jobRow?.title, jobRow?.internal_title]
        .filter((t): t is string => !!t && t.trim().length > 1);
      if (derived.length > 0) {
        criteria.title_keywords = Array.from(new Set(derived));
        console.log(`🩹 Derived title_keywords from job: ${JSON.stringify(criteria.title_keywords)}`);
      }
    }

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

    // PDL and Apollo run side by side (they used to wait for each other).
    const runPdl = async () => {
    if (pdlCacheValid) {
      console.log('✅ PDL cache timestamp valid — checking for cached rows');
      const { data: cached } = await supabase
        .from('sourcing_preview_candidates')
        .select('*')
        .eq('sourcing_project_id', sourcing_project_id)
        .eq('source', 'pdl')
        .limit(2000);

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

    };

    // ── Apollo: delegate to search-apollo-candidates (handles its own cache) ──
    let apolloCandidates: any[] = [];
    let apolloSearchMetadata: any = {};

    const runApollo = async () => {
    try {
      console.log('🔄 Calling search-apollo-candidates');
      const { data: apolloResult, error: apolloError } = await supabase.functions.invoke('search-apollo-candidates', {
        body: {
          project_id: sourcing_project_id,
          criteria,
          limit: Math.min(limit, 2000),
          max_results: Math.min(limit, 2000),
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
    };

    await Promise.all([runPdl(), runApollo()]);

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

    // ── Cross-reference Apollo results with existing Apollo-linked candidates ──
    // SECURITY: scope by tenant_id to prevent cross-tenant data leakage
    const apolloIds = dedupedApollo
      .map((c: any) => c.apollo_id)
      .filter(Boolean);

    // Collect linkedin URLs as a safety-net key for collected rows whose apollo_id
    // may not exactly match what Apollo returned on a subsequent search.
    const linkedinUrls = dedupedApollo
      .map((c: any) => c.linkedin_url)
      .filter(Boolean);

    let sameTenantMap = new Map<string, any>();

    if (apolloIds.length > 0) {
      // In chunks: 2,000 ids in one request is too long a URL, and a failed
      // lookup would show people we already have as new.
      const idChunks: string[][] = [];
      for (let i = 0; i < apolloIds.length; i += 300) idChunks.push(apolloIds.slice(i, i + 300));
      const collected = (await Promise.all(idChunks.map(async (ids) => {
        const { data, error } = await supabase
          .from('candidates')
          .select('id, apollo_id, tenant_id, candidate_name, email, phone, linkedin_url, location_city, location_state, location_country, company_current, role_current, skills, profile_summary, years_experience, apollo_collected_at')
          .eq('tenant_id', projectTenantId)
          .is('deleted_at', null)
          .is('merged_into', null)
          .in('apollo_id', ids);
        if (error) throw new Error(`Couldn't check which Apollo people are already in Gio: ${error.message}`);
        return data || [];
      }))).flat();

      // Only this workspace's candidates. The cross-workspace "Gio" lane was
      // removed (Allan, 2026-10-11): it showed other workspaces' private data.
      for (const c of (collected || [])) sameTenantMap.set(c.apollo_id, c);

      // Safety net — for any apollo_id we still didn't match in the same tenant,
      // try matching by linkedin_url within the same tenant. This catches collected
      // rows whose apollo_id drifted between searches.
      const unmatchedApolloIds = apolloIds.filter((id: string) => !sameTenantMap.has(id));
      if (projectTenantId && unmatchedApolloIds.length > 0 && linkedinUrls.length > 0) {
        const { data: byLinkedin } = await supabase
          .from('candidates')
          .select('id, apollo_id, tenant_id, candidate_name, email, phone, linkedin_url, location_city, location_state, location_country, company_current, role_current, skills, profile_summary, years_experience, apollo_collected_at')
          .eq('tenant_id', projectTenantId)
          .not('apollo_collected_at', 'is', null)
          .in('linkedin_url', linkedinUrls)
          .limit(2000);

        if (byLinkedin && byLinkedin.length > 0) {
          // Build a linkedin_url → candidate map so we can re-key onto the Apollo row's apollo_id
          const liMap = new Map<string, any>();
          for (const c of byLinkedin) {
            if (c.linkedin_url) liMap.set(c.linkedin_url, c);
          }
          for (const c of dedupedApollo) {
            if (!c.apollo_id || sameTenantMap.has(c.apollo_id)) continue;
            const match = c.linkedin_url ? liMap.get(c.linkedin_url) : null;
            if (match) sameTenantMap.set(c.apollo_id, match);
          }
        }
      }

      console.log(`✅ Collected matches: ${sameTenantMap.size} in this workspace, ${apolloIds.length - sameTenantMap.size} new from Apollo`);
    }


    // ── Our own candidates first (Find Phase 1, 2026-10-12) ──
    // search_candidates() runs the project's criteria over the workspace's
    // candidates; Apollo results that are people we already have join them.
    // Since 2026-10-22 everyone with a profile gets searchMatch() (skills by
    // tier, read from their work history too); Apollo previews get checks.
    const ctx = matchContext(criteria);
    const { loc, seniorities, companies } = ctx;
    const skillTerms = allSkills(ctx.tiers);

    const { data: internalHits, error: internalError } = await supabase.rpc('search_candidates', {
      p_tenant: projectTenantId,
      p_titles: criteria.title_keywords ?? null,
      p_keywords: skillTerms.length ? skillTerms : null,
      p_companies: companies.length ? companies : null,
      p_countries: loc.countries.length ? loc.countries : null,
      p_cities: loc.cities.length ? loc.cities : null,
      p_seniorities: seniorities.length ? seniorities : null,
      p_limit: 300,
    });
    if (internalError) console.warn('⚠️ Internal search failed:', internalError.message);
    const internalMatched = new Map<string, string[]>((internalHits || []).map((h: any) => [h.candidate_id, h.matched || []]));

    // Everyone in the internal lane: search hits plus Apollo rows we already have.
    const internalIds = new Set<string>([...internalMatched.keys()]);
    for (const c of sameTenantMap.values()) internalIds.add(c.id);

    const internalRows = new Map<string, any>();
    const pipelineByCandidate = new Map<string, any[]>();
    const historyByCandidate = new Map<string, string[]>();
    const idList = [...internalIds];
    const chunks: string[][] = [];
    for (let i = 0; i < idList.length; i += 200) chunks.push(idList.slice(i, i + 200));
    // Profiles, pipelines and work history load in parallel, chunk by chunk.
    await Promise.all(chunks.map(async (ids) => {
      const [rowsRes, assocRes, workRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, apollo_id, candidate_name, email, phone, linkedin_url, location_city, location_state, location_country, company_current, role_current, current_job_title, seniority_level, skills, standardized_skills, profile_summary, bio, years_experience, apollo_collected_at, source, updated_at')
          .eq('tenant_id', projectTenantId)
          .is('deleted_at', null)
          .is('merged_into', null)
          .in('id', ids),
        supabase
          .from('job_candidate_associations')
          .select('candidate_id, job_id, status, updated_at, ai_fit_score, jobs(title), job_hiring_stages(custom_stage_name, job_stages(stage_name))')
          .in('candidate_id', ids),
        supabase
          .from('candidate_work_experience')
          .select('candidate_id, job_title, company_name, description, skills_used')
          .in('candidate_id', ids)
          .limit(4000),
      ]);
      for (const r of rowsRes.data || []) internalRows.set(r.id, r);
      for (const a of assocRes.data || []) {
        const list = pipelineByCandidate.get(a.candidate_id) || [];
        list.push({
          job_id: a.job_id,
          job_title: (a as any).jobs?.title || 'Job',
          stage_name: (a as any).job_hiring_stages?.custom_stage_name || (a as any).job_hiring_stages?.job_stages?.stage_name || null,
          status: a.status,
          updated_at: a.updated_at,
          gio_fit: typeof (a as any).ai_fit_score === 'number' ? (a as any).ai_fit_score : null,
        });
        pipelineByCandidate.set(a.candidate_id, list);
      }
      for (const w of workRes.data || []) {
        const list = historyByCandidate.get(w.candidate_id) || [];
        list.push([w.job_title, w.company_name, w.description, (w.skills_used || []).join(' ')].filter(Boolean).join(' '));
        historyByCandidate.set(w.candidate_id, list);
      }
    }));

    // People already in the linked job's pipeline stay out of the results.
    const inLinkedJob = (id: string) =>
      !!project.job_id && (pipelineByCandidate.get(id) || []).some((p) => p.job_id === project.job_id);

    const apolloByCandidate = new Map<string, any>();
    for (const c of dedupedApollo) {
      const m = c.apollo_id ? sameTenantMap.get(c.apollo_id) : null;
      if (m) apolloByCandidate.set(m.id, c);
    }

    const matchFields = (m: ReturnType<typeof searchMatch>) => ({
      match_kind: 'search',
      match_score: m.score,
      match_tier: m.tier,
      fit_reasons: m.reasons,
      matched_skills: m.matched_skills,
      missing_must: m.missing_must,
      must_total: m.must_total,
    });

    let internalCount = 0;
    const internalLane: any[] = [];
    for (const id of internalIds) {
      const r = internalRows.get(id);
      if (!r || inLinkedJob(id)) continue;
      const preview = apolloByCandidate.get(id);
      const title = r.role_current || r.current_job_title || preview?.current_title || null;
      const m = searchMatch({
        title,
        company: r.company_current,
        country: r.location_country,
        city: r.location_city,
        seniority: r.seniority_level,
        text: [r.bio, r.profile_summary, (r.skills || []).join(' '), (r.standardized_skills || []).join(' '), ...(historyByCandidate.get(r.id) || [])].filter(Boolean).join(' '),
      }, criteria, ctx);
      internalCount++;
      internalLane.push({
        ...(preview || {}),
        id: r.id,
        candidate_id: r.id,
        apollo_id: r.apollo_id || preview?.apollo_id || null,
        source: r.apollo_id || preview ? 'apollo' : 'local',
        display_source: 'internal',
        candidate_name: r.candidate_name,
        full_name: r.candidate_name,
        email: r.email,
        phone: r.phone,
        linkedin_url: r.linkedin_url,
        location_city: r.location_city,
        location_state: r.location_state,
        location_country: r.location_country,
        current_company: r.company_current,
        current_role: title,
        headline: title,
        skills: r.skills || [],
        years_experience: r.years_experience,
        summary: r.profile_summary || r.bio,
        is_preview: false,
        needs_enrichment: false,
        pipeline: (pipelineByCandidate.get(r.id) || []).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))),
        internal_match: internalMatched.get(r.id) || ['apollo'],
        ...matchFields(m),
        created_at: r.updated_at,
      });
    }
    internalLane.sort((a, b) => (b.match_score - a.match_score));

    // New people from Apollo carry only a name, title and company: no score,
    // just what was checked. Place and seniority count as filtered by Apollo
    // when the search sent them.
    const sent = {
      place: (criteria.locations ?? []).some((l: string) => typeof l === 'string' && (regionFor(l)?.length ?? 0) > 0),
      seniority: (criteria.seniorities ?? []).length > 0,
    };
    let apolloPreviewCount = 0;
    const enrichedApollo = dedupedApollo
      .filter((c: any) => !(c.apollo_id && sameTenantMap.has(c.apollo_id)))
      .map((c: any) => {
        apolloPreviewCount++;
        const checks = previewChecks({ title: c.current_title || c.headline, company: c.current_company }, criteria, ctx, sent);
        return { ...c, display_source: 'apollo', match_kind: 'preview', match_score: null, match_tier: null, fit_reasons: [], checks };
      })
      .sort((a: any, b: any) => b.checks.rank - a.checks.rank);

    console.log(`📊 Lanes: ${internalCount} already in Gio, ${apolloPreviewCount} new from Apollo`);

    // ── Project state (shortlist / not a fit / archive / collected) ──
    // Lives apart from the search cache, so it survives every refresh.
    const { data: stateRows } = await supabase
      .from('sourcing_project_candidates')
      .select('apollo_id, candidate_id, status, collected_at')
      .eq('sourcing_project_id', sourcing_project_id);
    const stateByApollo = new Map((stateRows || []).filter((r: any) => r.apollo_id).map((r: any) => [r.apollo_id, r]));
    const stateByCandidate = new Map((stateRows || []).filter((r: any) => r.candidate_id).map((r: any) => [r.candidate_id, r]));
    for (const c of [...internalLane, ...enrichedApollo] as any[]) {
      const st = (c.candidate_id && stateByCandidate.get(c.candidate_id)) || (c.apollo_id ? stateByApollo.get(c.apollo_id) : null);
      if (!st) continue;
      c.project_status = st.status;
      c.project_collected_at = st.collected_at;
    }

    // PDL rows have a profile, so they get the same search match (no more fixed 100).
    const taggedPdl = pdlCandidates.map((c: any) => {
      const m = searchMatch({
        title: c.current_title || c.headline,
        company: c.current_company,
        country: c.location_country,
        city: c.location_city,
        seniority: (c.job_title_levels || [])[0] ?? null,
        text: [c.summary, (c.skills || []).join(' '), ...(c.experience || []).map((e: any) => [e?.title?.name ?? e?.title, e?.company?.name ?? e?.company, e?.summary].filter((x: unknown) => typeof x === 'string').join(' '))].filter(Boolean).join(' '),
      }, criteria, ctx);
      return { ...c, display_source: 'pdl', ...matchFields(m) };
    }).sort((a: any, b: any) => b.match_score - a.match_score);

    // Lanes: already in Gio first, then PDL, then new from Apollo.
    const allCandidates = [...internalLane, ...taggedPdl, ...enrichedApollo];

    const sourceBreakdown = {
      internal: internalCount,
      gio: 0,
      pdl: pdlCandidates.length,
      apollo: apolloPreviewCount,
      full_data: internalCount + pdlCandidates.length,
      preview_only: apolloPreviewCount,
      deduplicated,
    };

    // When the search last ran, for the results header (not updated_at, which
    // any edit to the project moves).
    await supabase.from('sourcing_projects').update({ last_search_at: new Date().toISOString() }).eq('id', sourcing_project_id);

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

  } catch (error) {
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
