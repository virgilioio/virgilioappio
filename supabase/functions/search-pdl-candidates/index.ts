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

/**
 * Build PDL ElasticSearch query from search criteria
 */
function buildPdlQuery(criteria: SearchCriteria): Record<string, any> {
  const must: any[] = [];

  // Title keywords → job_title
  if (criteria.title_keywords?.length) {
    must.push({
      bool: {
        should: criteria.title_keywords.map(title => ({
          term: { job_title: title }
        })),
        minimum_should_match: 1
      }
    });
  }

  // Location filter
  if (criteria.locations?.length) {
    const locationClauses: any[] = [];
    for (const loc of criteria.locations) {
      const parts = loc.split(',').map((p: string) => p.trim());
      if (parts.length === 3) {
        locationClauses.push({
          bool: {
            must: [
              { term: { location_locality: parts[0] } },
              { term: { location_country: parts[2].toLowerCase() } }
            ]
          }
        });
      } else if (parts.length === 2) {
        locationClauses.push({
          bool: {
            must: [
              { term: { location_region: parts[0] } },
              { term: { location_country: parts[1].toLowerCase() } }
            ]
          }
        });
      } else if (parts.length === 1) {
        locationClauses.push({ term: { location_country: parts[0].toLowerCase() } });
      }
    }
    if (locationClauses.length) {
      must.push({ bool: { should: locationClauses, minimum_should_match: 1 } });
    }
  }

  // Skills
  if (criteria.skills?.length) {
    must.push({
      bool: {
        should: criteria.skills.map(skill => ({
          term: { skills: skill }
        })),
        minimum_should_match: 1
      }
    });
  }

  // Company names (user + researched combined)
  const allCompanies = [
    ...(criteria.user_company_names || []),
    ...(criteria.researched_companies || []),
    ...(criteria.company_names || [])
  ].filter(Boolean);
  
  if (allCompanies.length) {
    must.push({
      bool: {
        should: allCompanies.map(company => ({
          term: { job_company_name: company }
        })),
        minimum_should_match: 1
      }
    });
  }

  return {
    query: {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }]
      }
    }
  };
}

/**
 * Map a PDL person result to our MatchedCandidate shape with ALL fields
 */
function mapPdlCandidate(person: any): any {
  // Build experience array
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

  // Build education array
  const education = (person.education || []).map((edu: any) => ({
    school: edu.school?.name || null,
    degree: edu.degrees?.join(', ') || null,
    field_of_study: edu.majors?.join(', ') || null,
    start_date: edu.start_date || null,
    end_date: edu.end_date || null,
  }));

  // Build certifications array
  const certifications = (person.certifications || []).map((cert: any) => ({
    name: cert.name || cert,
    organization: cert.organization || null,
  }));

  // Build emails array
  const emails = (person.emails || []).map((e: any) => ({
    address: typeof e === 'string' ? e : (e.address || e),
    type: typeof e === 'object' ? e.type : null,
  }));

  // Build phones array
  const phones = (person.phone_numbers || person.mobile_phone ? 
    [...(person.phone_numbers || []), person.mobile_phone].filter(Boolean) : []
  ).map((p: any) => ({
    number: typeof p === 'string' ? p : (p.number || p),
    type: typeof p === 'object' ? p.type : null,
  }));

  // Current job info
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
    // Availability flags (PDL always has full data)
    has_email: emails.length > 0,
    has_phone: phones.length > 0,
    has_location: !!(person.location_locality || person.location_region || person.location_country),
    // PDL-specific flags
    source: 'pdl',
    is_preview: false,
    needs_enrichment: false,
    match_score: 100,
    match_tier: 'good',
  };
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    const { criteria, limit = 5 } = await req.json();

    // HARD CAP: Never exceed 10 results
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

    // Build and execute PDL search
    const pdlQuery = buildPdlQuery(criteria);
    console.log('📡 PDL query:', JSON.stringify(pdlQuery));

    const response = await fetch(PDL_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': PDL_API_KEY,
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
      console.error('❌ PDL API Error:', response.status, errorText);
      
      // Graceful fallback on any error — return empty so Apollo results still show
      return new Response(JSON.stringify({
        candidates: [],
        total_count: 0,
        provider: 'pdl',
        error: `PDL API error: ${response.status}`,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const data = await response.json();
    const totalAvailable = data.total || 0;
    const people = data.data || [];

    console.log(`✅ PDL returned ${people.length} results (total available: ${totalAvailable})`);

    // Log sample for debugging
    if (people.length > 0) {
      const sample = people[0];
      console.log('📦 Sample PDL result:', JSON.stringify({
        id: sample.id,
        full_name: sample.full_name,
        job_title: sample.job_title,
        job_company_name: sample.job_company_name,
        linkedin_url: sample.linkedin_url,
        skills_count: sample.skills?.length || 0,
        experience_count: sample.experience?.length || 0,
        education_count: sample.education?.length || 0,
        emails_count: sample.emails?.length || 0,
        phone_numbers_count: sample.phone_numbers?.length || 0,
      }));
    }

    // Map ALL results with full field passthrough
    const candidates = people.map(mapPdlCandidate);

    return new Response(JSON.stringify({
      candidates,
      total_count: totalAvailable,
      provider: 'pdl',
      credits_used: people.length,  // PDL charges per result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  } catch (error: any) {
    console.error('❌ PDL search error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      provider: 'pdl',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
});
