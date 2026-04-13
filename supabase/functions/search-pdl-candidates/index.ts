import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const PDL_API_KEY = Deno.env.get('PDL_API_KEY');
const PDL_SEARCH_URL = 'https://api.peopledatalabs.com/v5/person/search';

// Hard cap: NEVER return more than 10 PDL results per search
const ABSOLUTE_MAX_LIMIT = 10;

interface SearchCriteria {
  title_keywords?: string[];
  locations?: string[];
  skills?: string[];
  company_names?: string[];
  user_company_names?: string[];
  researched_companies?: string[];
  seniorities?: string[];
  keywords?: string[];
}

// ── Query builders ──────────────────────────────────────────────

function titleClause(titles: string[]): Record<string, any> {
  return {
    bool: {
      should: titles.map(t => ({ term: { job_title: t } }))
    }
  };
}

function locationClauses(locations: string[]): Record<string, any> | null {
  const clauses: any[] = [];
  for (const loc of locations) {
    const parts = loc.split(',').map((p: string) => p.trim());
    if (parts.length === 3) {
      clauses.push({ bool: { must: [
        { term: { location_locality: parts[0] } },
        { term: { location_country: parts[2].toLowerCase() } }
      ]}});
    } else if (parts.length === 2) {
      clauses.push({ bool: { must: [
        { term: { location_region: parts[0] } },
        { term: { location_country: parts[1].toLowerCase() } }
      ]}});
    } else if (parts.length === 1) {
      clauses.push({ term: { location_country: parts[0].toLowerCase() } });
    }
  }
  return clauses.length ? { bool: { should: clauses } } : null;
}

function skillsClauses(skills: string[]): Record<string, any> {
  return {
    bool: {
      should: skills.map(s => ({ term: { skills: s } }))
    }
  };
}

function companyClauses(criteria: SearchCriteria): Record<string, any> | null {
  const all = [
    ...(criteria.user_company_names || []),
    ...(criteria.researched_companies || []),
    ...(criteria.company_names || [])
  ].filter(Boolean);
  if (!all.length) return null;
  return {
    bool: {
      should: all.map(c => ({ term: { job_company_name: c } }))
    }
  };
}

/**
 * Build progressive query attempts — return array of queries to try in order.
 * First non-empty result wins.
 */
function buildQueryAttempts(criteria: SearchCriteria): Array<{ label: string; query: Record<string, any> }> {
  const titles = criteria.title_keywords || [];
  if (!titles.length) return [];

  const attempts: Array<{ label: string; query: Record<string, any> }> = [];
  const tc = titleClause(titles);
  const lc = criteria.locations?.length ? locationClauses(criteria.locations!) : null;
  const sc = criteria.skills?.length ? skillsClauses(criteria.skills!) : null;
  const cc = companyClauses(criteria);

  // Attempt 1: titles + location (if location provided)
  if (lc) {
    attempts.push({
      label: 'titles+location',
      query: { query: { bool: { must: [tc, lc] } } }
    });
  }

  // Attempt 2: titles only (broadest)
  attempts.push({
    label: 'titles_only',
    query: { query: { bool: { must: [tc] } } }
  });

  // Attempt 3: titles + companies (if provided)
  if (cc) {
    attempts.push({
      label: 'titles+companies',
      query: { query: { bool: { must: [tc], should: [cc] } } }
    });
  }

  // Attempt 4: titles + skills (if provided)
  if (sc) {
    attempts.push({
      label: 'titles+skills',
      query: { query: { bool: { must: [tc], should: [sc] } } }
    });
  }

  return attempts;
}

/**
 * Map a PDL person result to our MatchedCandidate shape with ALL fields
 */
function mapPdlCandidate(person: any): any {
  const experience = (person.experience || []).map((exp: any) => ({
    company: exp.company?.name || null,
    title: exp.title?.name || null,
    start_date: exp.start_date || null,
    end_date: exp.end_date || null,
    is_current: exp.is_primary || false,
    location: exp.location_names?.join(', ') || null,
    summary: exp.summary || null,
    company_size: exp.company?.size || null,
    company_industry: exp.company?.industry || null,
  }));

  const education = (person.education || []).map((edu: any) => ({
    school: edu.school?.name || null,
    degree: edu.degrees?.join(', ') || null,
    field_of_study: edu.majors?.join(', ') || null,
    start_date: edu.start_date || null,
    end_date: edu.end_date || null,
  }));

  const certifications = (person.certifications || []).map((cert: any) => ({
    name: cert.name || cert,
    organization: cert.organization || null,
  }));

  const emails = (person.emails || []).map((e: any) => ({
    address: typeof e === 'string' ? e : (e.address || e),
    type: typeof e === 'object' ? e.type : null,
  }));

  const phones = (person.phone_numbers || person.mobile_phone ?
    [...(person.phone_numbers || []), person.mobile_phone].filter(Boolean) : []
  ).map((p: any) => ({
    number: typeof p === 'string' ? p : (p.number || p),
    type: typeof p === 'object' ? p.type : null,
  }));

  const currentExp = experience.find((e: any) => e.is_current) || experience[0];

  return {
    pdl_id: person.id,
    full_name: person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
    candidate_name: person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
    headline: person.headline || currentExp?.title || null,
    current_title: person.job_title || currentExp?.title || null,
    current_company: person.job_company_name || currentExp?.company || null,
    linkedin_url: person.linkedin_url || null,
    github_url: person.github_url || null,
    twitter_url: person.twitter_url || null,
    website_url: person.website_url || person.personal_urls?.[0] || null,
    location_city: person.location_locality || null,
    location_state: person.location_region || null,
    location_country: person.location_country || null,
    summary: person.summary || person.bio || null,
    skills: person.skills || [],
    job_title_levels: person.job_title_levels || [],
    experience,
    education,
    certifications,
    emails,
    phones,
    has_email: emails.length > 0,
    has_phone: phones.length > 0,
    has_location: !!(person.location_locality || person.location_region || person.location_country),
    source: 'pdl',
    is_preview: false,
    needs_enrichment: false,
    match_score: 100,
    match_tier: 'good',
  };
}

/**
 * Execute a single PDL search attempt
 */
async function executePdlSearch(
  pdlQuery: Record<string, any>,
  effectiveLimit: number
): Promise<{ people: any[]; totalAvailable: number; status: number }> {
  const response = await fetch(PDL_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': PDL_API_KEY!,
    },
    body: JSON.stringify({
      ...pdlQuery,
      size: effectiveLimit,
      dataset: 'all',
      titlecase: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`⚠️ PDL API ${response.status}: ${errorText}`);
    return { people: [], totalAvailable: 0, status: response.status };
  }

  const data = await response.json();
  return {
    people: data.data || [],
    totalAvailable: data.total || 0,
    status: response.status,
  };
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { criteria, limit = 5 } = await req.json();
    const effectiveLimit = Math.min(Math.max(limit, 1), ABSOLUTE_MAX_LIMIT);

    console.log(`🔍 PDL Search: limit=${effectiveLimit}, criteria:`, JSON.stringify(criteria));

    if (!PDL_API_KEY) {
      throw new Error('PDL_API_KEY not configured');
    }

    if (!criteria?.title_keywords?.length) {
      return new Response(JSON.stringify({
        candidates: [],
        total_count: 0,
        provider: 'pdl',
        message: 'No title keywords provided for PDL search'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Build progressive query attempts
    const attempts = buildQueryAttempts(criteria);

    let winningLabel = 'none';
    let winningPeople: any[] = [];
    let winningTotal = 0;

    for (const attempt of attempts) {
      console.log(`📡 PDL attempt [${attempt.label}]:`, JSON.stringify(attempt.query));

      const result = await executePdlSearch(attempt.query, effectiveLimit);

      if (result.people.length > 0) {
        winningLabel = attempt.label;
        winningPeople = result.people;
        winningTotal = result.totalAvailable;
        console.log(`✅ PDL [${attempt.label}] returned ${result.people.length} results (total: ${result.totalAvailable})`);
        break; // First non-empty wins — stop to avoid burning more credits
      }

      console.log(`⚠️ PDL [${attempt.label}] returned 0 results, trying next...`);
    }

    if (winningPeople.length === 0) {
      console.log('❌ PDL: all query attempts returned 0 results');
      return new Response(JSON.stringify({
        candidates: [],
        total_count: 0,
        provider: 'pdl',
        winning_strategy: 'none',
        message: 'No PDL results for any query strategy',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const candidates = winningPeople.map(mapPdlCandidate);

    return new Response(JSON.stringify({
      candidates,
      total_count: winningTotal,
      provider: 'pdl',
      credits_used: winningPeople.length,
      winning_strategy: winningLabel,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error: any) {
    console.error('❌ PDL search error:', error);
    return new Response(JSON.stringify({
      candidates: [],
      total_count: 0,
      provider: 'pdl',
      error: error.message,
    }), {
      status: 200, // Return 200 so orchestrator treats it as graceful fallback
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
