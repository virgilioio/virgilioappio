import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";
import {
  calculateEnhancedCandidateScore,
  CandidateScore,
  getMatchTier
} from "../_shared/candidateMatching.ts";

const corsHeaders = createSecureCorsHeaders();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ============================================================================
// TITLE SYNONYM MAP - For synonym-aware matching
// ============================================================================
const TITLE_SYNONYMS: Record<string, string[]> = {
  'account executive': ['ae', 'sales executive', 'account manager', 'sales rep', 'sales representative'],
  'sales development representative': ['sdr', 'bdr', 'business development rep', 'business development representative', 'outbound rep'],
  'product marketing manager': ['pmm', 'product marketer', 'product marketing lead'],
  'software engineer': ['swe', 'software developer', 'developer', 'programmer', 'engineer'],
  'revenue operations': ['revops', 'sales ops', 'sales operations', 'revenue ops'],
  'customer success manager': ['csm', 'customer success', 'client success manager'],
  'solutions engineer': ['se', 'sales engineer', 'pre-sales engineer', 'solutions architect'],
  'product manager': ['pm', 'product owner', 'product lead'],
  'ux designer': ['product designer', 'ui/ux designer', 'ui designer', 'user experience designer'],
  'devops engineer': ['sre', 'site reliability engineer', 'platform engineer', 'infrastructure engineer'],
  'data scientist': ['ml engineer', 'machine learning engineer', 'data analyst'],
  'frontend engineer': ['frontend developer', 'front-end engineer', 'ui engineer', 'react developer'],
  'backend engineer': ['backend developer', 'back-end engineer', 'server engineer'],
  'fullstack engineer': ['full stack developer', 'fullstack developer', 'full-stack engineer'],
  'technical recruiter': ['tech recruiter', 'engineering recruiter', 'talent acquisition'],
  'content marketer': ['content marketing manager', 'content strategist', 'content writer'],
  'growth marketer': ['growth marketing manager', 'growth lead', 'growth hacker'],
  'demand generation': ['demand gen', 'demand generation manager', 'marketing operations'],
};

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function getTitleMatchScore(candidateTitle: string, targetTitles: string[]): number {
  if (!candidateTitle || !targetTitles?.length) return 0;
  
  const normalizedCandidate = normalizeTitle(candidateTitle);
  
  for (const target of targetTitles) {
    const normalizedTarget = normalizeTitle(target);
    
    // Exact/contains match - highest score
    if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) {
      return 40;
    }
    
    // Synonym match - check if candidate matches any synonym of target
    const synonyms = TITLE_SYNONYMS[normalizedTarget] || [];
    for (const synonym of synonyms) {
      if (normalizedCandidate.includes(synonym)) return 30;
    }
    
    // Reverse check: candidate title might be the canonical form
    for (const [canonical, syns] of Object.entries(TITLE_SYNONYMS)) {
      if (normalizedCandidate.includes(canonical) && syns.some(s => normalizedTarget.includes(s))) {
        return 30;
      }
      // Also check if candidate is a synonym that maps to the target
      if (syns.some(s => normalizedCandidate.includes(s)) && normalizedTarget.includes(canonical)) {
        return 30;
      }
    }
    
    // Token overlap - partial match
    const targetTokens = new Set(normalizedTarget.split(/\s+/).filter(t => t.length > 2));
    const candidateTokens = normalizedCandidate.split(/\s+/).filter(t => t.length > 2);
    const overlapCount = candidateTokens.filter(t => targetTokens.has(t)).length;
    if (overlapCount >= 2) return 20;
  }
  
  return 0;
}

// Calculate title match rate using synonym-aware matching
function calculateTitleMatchRate(candidates: any[], titleKeywords: string[]): number {
  if (candidates.length === 0 || !titleKeywords?.length) return 0;
  
  let matchCount = 0;
  for (const candidate of candidates) {
    const candidateTitle = candidate.current_title || candidate.current_role || '';
    // Use getTitleMatchScore >= 20 as "match"
    if (getTitleMatchScore(candidateTitle, titleKeywords) >= 20) {
      matchCount++;
    }
  }
  
  return (matchCount / candidates.length) * 100;
}

// ============================================================================
// LOCATION BROADENING - For progressive relaxation
// ============================================================================
function broadenLocation(criteria: any): { broadened: boolean; newCriteria: any } {
  if (!criteria.locations?.length) {
    return { broadened: false, newCriteria: criteria };
  }
  
  const newLocations: string[] = [];
  let didBroaden = false;
  
  for (const loc of criteria.locations) {
    const parts = loc.split(',').map((p: string) => p.trim());
    
    if (parts.length >= 3) {
      // city,state,country → state,country (drop city)
      newLocations.push(parts.slice(1).join(','));
      didBroaden = true;
    } else if (parts.length === 2) {
      // state,country → country (drop state)
      newLocations.push(parts[1]);
      didBroaden = true;
    } else {
      // country only → keep as-is (no further broadening)
      newLocations.push(loc);
    }
  }
  
  return {
    broadened: didBroaden,
    newCriteria: { ...criteria, locations: [...new Set(newLocations)] }
  };
}

// Check if location is strict (city-level)
function hasStrictLocation(criteria: any): boolean {
  return criteria.locations?.some((loc: string) => loc.split(',').length >= 2) || false;
}

// ============================================================================
// INTERFACES
// ============================================================================
interface JobMatchingRequest {
  job_id?: string;
  sourcing_project_id?: string;
  criteria?: SearchCriteria;
  limit?: number;
  count_only?: boolean;
  filters?: {
    match_tier?: ('excellent' | 'good' | 'fair')[];
    location?: string;
    min_experience?: number;
    max_experience?: number;
  };
}

interface SearchCriteria {
  skills: string[];
  location?: string;
  locations?: string[];
  title_keywords?: string[];
  user_company_names?: string[];
  researched_companies?: string[];
  company_names?: string[];
  keywords?: string[];
  seniorities?: string[];
  experience_years?: {
    min?: number;
    max?: number;
  };
}

interface SearchMetadata {
  search_expanded: boolean;
  expanded_steps: Array<'dropped_booster_companies' | 'dropped_keywords' | 'dropped_seniorities' | 'broadened_location'>;
  result_pool_size: number;
  returned_count: number;
  overflow_warning: boolean;
  title_match_rate?: number;
  fallback_trigger_reason?: 'zero_results' | 'low_quality' | null;
  has_user_companies?: boolean;
}

interface MatchedCandidate {
  id: string;
  candidate_name: string;
  skills?: string[];
  standardized_skills?: string[];
  location_country?: string;
  location_city?: string;
  location_state?: string;
  location?: string;
  linkedin_url?: string;
  salary_amount?: number;
  salary_currency?: string;
  salary_period?: string;
  match_score: number;
  match_tier: 'excellent' | 'good' | 'fair' | 'minimal';
  profile_summary?: string;
  source: 'local' | 'apollo';
  years_experience?: number;
  enriched_at?: string;
  current_company?: string;
  current_role?: string;
  score_breakdown?: CandidateScore;
  competitive_advantage?: string[];
  apollo_id?: string;
  apollo_score?: number;
  headline?: string;
  email?: string;
  email_status?: string;
  phone?: string;
  candidate_id?: string | null;
  has_email?: boolean;
  has_phone?: boolean;
  relevance_score?: number;
}

interface JobMatchingResult {
  candidates: MatchedCandidate[];
  total_count: number;
  breakdown: {
    localCandidates: number;
    apolloCandidates: number;
    averageMatch: number;
    creditsUsed?: number;
    collectCreditsUsed?: number;
  };
  search_metadata?: SearchMetadata;
}

// ============================================================================
// SCORING HELPERS
// ============================================================================
function calculateSkillMatch(jobSkills: string[], candidateSkills: string[], candidateSummary?: string): number {
  const mockCandidate = {
    skills: candidateSkills,
    profile_summary: candidateSummary
  };
  const mockJob = { title: 'Generic Position' };
  const score = calculateEnhancedCandidateScore(mockCandidate, jobSkills, mockJob);
  return score.total_score;
}

// Calculate relevance score for ranking (uses synonym-aware title matching)
function calculateRelevanceScore(candidate: MatchedCandidate, criteria: SearchCriteria): number {
  let score = 0;
  
  // Title match (0-40 pts) — uses synonym-aware scoring
  if (candidate.current_role && criteria.title_keywords?.length) {
    score += getTitleMatchScore(candidate.current_role, criteria.title_keywords);
  }
  
  // Location match (0-20 pts)
  if (criteria.locations?.length) {
    const candidateLocation = [
      candidate.location_city,
      candidate.location_state,
      candidate.location_country
    ].filter(Boolean).join(' ').toLowerCase();
    
    for (const loc of criteria.locations) {
      const locParts = loc.toLowerCase().split(',').map((p: string) => p.trim());
      if (locParts.some(part => candidateLocation.includes(part))) {
        if (candidate.location_city && locParts[0]?.includes(candidate.location_city.toLowerCase())) {
          score += 20; // City match
        } else if (candidate.location_state) {
          score += 15; // State match
        } else {
          score += 10; // Country match
        }
        break;
      }
    }
  }
  
  // User company bonus (30 pts)
  if (criteria.user_company_names?.length && candidate.current_company) {
    const candidateCompany = candidate.current_company.toLowerCase();
    if (criteria.user_company_names.some(c => candidateCompany.includes(c.toLowerCase()))) {
      score += 30;
    }
  }
  
  // Seniority fit (10 pts)
  if (criteria.seniorities?.length && candidate.current_role) {
    const roleLower = candidate.current_role.toLowerCase();
    if (criteria.seniorities.some(s => roleLower.includes(s.toLowerCase()))) {
      score += 10;
    }
  }
  
  return score;
}

// Comparative analysis for competitive advantages
function performComparativeAnalysis(candidates: MatchedCandidate[]): MatchedCandidate[] {
  if (candidates.length < 2) return candidates;
  
  const experienceGroups = new Map<string, MatchedCandidate[]>();
  
  candidates.forEach(candidate => {
    const expGroup = getExperienceGroup(candidate.years_experience || 0);
    if (!experienceGroups.has(expGroup)) {
      experienceGroups.set(expGroup, []);
    }
    experienceGroups.get(expGroup)!.push(candidate);
  });
  
  experienceGroups.forEach((group) => {
    if (group.length > 1) {
      group.forEach(candidate => {
        candidate.competitive_advantage = identifyCompetitiveAdvantages(candidate, group);
      });
    }
  });
  
  return candidates;
}

function getExperienceGroup(years: number): string {
  if (years <= 2) return 'junior';
  if (years <= 5) return 'mid';
  if (years <= 10) return 'senior';
  return 'executive';
}

function identifyCompetitiveAdvantages(candidate: MatchedCandidate, peers: MatchedCandidate[]): string[] {
  const advantages: string[] = [];
  
  const avgPeerScore = peers.filter(p => p.id !== candidate.id)
    .reduce((sum, p) => sum + p.match_score, 0) / (peers.length - 1);
  
  if (candidate.match_score > avgPeerScore + 10) {
    advantages.push('Higher skill match than peers');
  }
  
  if (candidate.current_role && (candidate.current_role.toLowerCase().includes('senior') || 
      candidate.current_role.toLowerCase().includes('lead'))) {
    advantages.push('Leadership experience in current role');
  }
  
  const skillCount = candidate.skills?.length || 0;
  const avgPeerSkills = peers.filter(p => p.id !== candidate.id)
    .reduce((sum, p) => sum + (p.skills?.length || 0), 0) / (peers.length - 1);
    
  if (skillCount > avgPeerSkills + 3) {
    advantages.push('Broader skill set than peers');
  }
  
  return advantages;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      job_id, 
      sourcing_project_id,
      criteria: providedCriteria,
      limit = 500,
      count_only = false,
      filters: requestFilters
    }: JobMatchingRequest = await req.json();

    let filters = requestFilters;
    let jobSkills: string[] = [];
    let job: any = null;
    let organization_id: string | null = null;
    let tenant_id: string | null = null;
    let criteria: any = null;

    // Load from sourcing project
    if (sourcing_project_id) {
      console.log(`🎯 Finding candidates for sourcing project: ${sourcing_project_id}${count_only ? ' (count only)' : ''}`);
      
      const { data: project, error: projectError } = await supabase
        .from('sourcing_projects')
        .select('*, jobs(*), organizations(tenant_id)')
        .eq('id', sourcing_project_id)
        .single();
        
      if (projectError || !project) {
        throw new Error(`Sourcing project not found: ${projectError?.message || 'Unknown error'}`);
      }
      
      criteria = providedCriteria || (project.search_criteria as any);
      jobSkills = Array.isArray(criteria?.skills) ? criteria.skills : [];

      if (jobSkills.length === 0 && project && project.search_criteria) {
        const projectCriteria = typeof project.search_criteria === 'string' 
          ? JSON.parse(project.search_criteria)  
          : project.search_criteria;
        jobSkills = Array.isArray(projectCriteria?.skills) ? projectCriteria.skills : [];
      }

      organization_id = project.organization_id;
      tenant_id = project.organizations?.tenant_id || null;
      
      const locationValue = criteria.locations?.[0] || criteria.location || undefined;
      
      if (project.job_id && project.jobs) {
        job = project.jobs;
        job.title_keywords = criteria.title_keywords;
      } else {
        job = {
          id: sourcing_project_id,
          title: project.name,
          skills: jobSkills,
          standardized_skills: jobSkills,
          location: locationValue,
          title_keywords: criteria.title_keywords,
          salary_min: criteria.salary_min,
          salary_max: criteria.salary_max,
          currency: criteria.currency
        };
      }
      
      await supabase
        .from('sourcing_projects')
        .update({ last_search_at: new Date().toISOString() })
        .eq('id', sourcing_project_id);
    }
    // Load from job
    else if (job_id) {
      console.log(`🎯 Finding matching candidates for job: ${job_id}${count_only ? ' (count only)' : ''}`);
      
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, title, skills, standardized_skills, location, salary_min, salary_max, currency, organization_id, tenant_id')
        .eq('id', job_id)
        .single();

      if (jobError || !jobData) {
        throw new Error(`Job not found: ${jobError?.message || 'Unknown error'}`);
      }
      
      job = jobData;
      jobSkills = job.standardized_skills || job.skills || [];
      organization_id = job.organization_id;
      tenant_id = job.tenant_id;
      
      criteria = providedCriteria || {
        skills: jobSkills,
        location: job.location,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        currency: job.currency
      };
    } else {
      throw new Error('Either job_id or sourcing_project_id must be provided');
    }

    console.log(`📋 Search criteria: ${jobSkills.join(', ')}`);

    // Get existing candidate associations to exclude
    let existingCandidateIds = new Set<string>();

    if (job_id || (sourcing_project_id && job?.id && job_id !== sourcing_project_id)) {
      const targetJobId = job_id || job.id;
      const { data: existingAssociations, error: associationsError } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id')
        .eq('job_id', targetJobId);

      if (associationsError) {
        console.warn('Error fetching existing associations:', associationsError);
      }

      existingCandidateIds = new Set(
        existingAssociations?.map(assoc => assoc.candidate_id) || []
      );
      console.log(`🚫 Excluding ${existingCandidateIds.size} already associated candidates`);
    }

    // CRITICAL: Filter by tenant_id for tenant isolation
    if (!tenant_id) {
      throw new Error('Unable to determine tenant_id - data isolation required');
    }

    console.log(`🔒 Filtering candidates by tenant: ${tenant_id}`);

    // Get local candidates
    const candidateFields = count_only ? 'id, standardized_skills, skills, profile_summary, apollo_id' : `
      id,
      candidate_name,
      skills,
      standardized_skills,
      location_country,
      location_city,
      location_state,
      linkedin_url,
      salary_amount,
      salary_currency,
      salary_period,
      profile_summary,
      years_experience,
      enriched_at,
      company_current,
      role_current,
      apollo_id
    `;

    const { data: localCandidates, error: localError } = await supabase
      .from('candidates')
      .select(candidateFields)
      .eq('tenant_id', tenant_id)
      .is('deleted_at', null)
      .limit(2000);

    if (localError) {
      console.warn('Error fetching local candidates:', localError);
    }

    // Extract apollo_ids from local candidates for deduplication
    const localApolloIds = new Set<string>();
    if (localCandidates) {
      for (const candidate of localCandidates) {
        if ((candidate as any).apollo_id) {
          localApolloIds.add((candidate as any).apollo_id);
        }
      }
    }
    console.log(`🔗 Found ${localApolloIds.size} local candidates with Apollo IDs for deduplication`);

    const matchedCandidates: MatchedCandidate[] = [];

    // Process local candidates
    if (localCandidates) {
      console.log(`🔍 Processing ${localCandidates.length} local candidates`);
      let excludedCount = 0;
      
      for (const candidate of localCandidates) {
        if (existingCandidateIds.has((candidate as any).id)) {
          excludedCount++;
          continue;
        }

        const candidateScore = calculateEnhancedCandidateScore(candidate, jobSkills, job);
        
        const minScore = sourcing_project_id ? 20 : 30;
        const minConfidence = sourcing_project_id ? 25 : 40;
        
        if (candidateScore.total_score >= minScore && candidateScore.confidence >= minConfidence) {
          if (count_only) {
            matchedCandidates.push({
              id: (candidate as any).id,
              match_score: candidateScore.total_score,
              match_tier: getMatchTier(candidateScore.total_score),
              source: 'local'
            } as any);
          } else {
            matchedCandidates.push({
              id: (candidate as any).id,
              candidate_name: (candidate as any).candidate_name,
              skills: (candidate as any).skills,
              standardized_skills: (candidate as any).standardized_skills,
              location_country: (candidate as any).location_country,
              location_city: (candidate as any).location_city,
              location_state: (candidate as any).location_state,
              linkedin_url: (candidate as any).linkedin_url,
              salary_amount: (candidate as any).salary_amount,
              salary_currency: (candidate as any).salary_currency,
              salary_period: (candidate as any).salary_period,
              match_score: candidateScore.total_score,
              match_tier: getMatchTier(candidateScore.total_score),
              profile_summary: (candidate as any).profile_summary,
              source: 'local',
              years_experience: (candidate as any).years_experience,
              enriched_at: (candidate as any).enriched_at,
              current_company: (candidate as any).company_current,
              current_role: (candidate as any).role_current,
              score_breakdown: candidateScore,
              competitive_advantage: []
            });
          }
        }
      }
      
      console.log(`📊 Filtered out ${excludedCount} already associated candidates`);
    }

    // ========================================================================
    // APOLLO INTEGRATION WITH TWO-SEARCH PROGRESSIVE RELAXATION
    // ========================================================================
    let apolloCandidates: MatchedCandidate[] = [];
    let creditsUsed = 0;
    let searchMetadata: SearchMetadata = {
      search_expanded: false,
      expanded_steps: [],
      result_pool_size: 0,
      returned_count: 0,
      overflow_warning: false,
      title_match_rate: undefined,
      fallback_trigger_reason: null,
      has_user_companies: (criteria.user_company_names?.length || 0) > 0
    };
    
    if (!count_only && organization_id && jobSkills.length > 0) {
      try {
        console.log(`🔍 Searching Apollo with progressive relaxation...`);
        
        // Build initial search criteria (Search A - full constraints)
        const locationToUse = sourcing_project_id && criteria.locations?.[0] 
          ? criteria.locations[0] 
          : (criteria.location || job.location);
        
        const searchCriteriaA: any = {
          skills: jobSkills,
          location: locationToUse,
          locations: criteria.locations,
          title_keywords: job.title_keywords || criteria.title_keywords,
          // Merge user companies + researched companies for Search A
          company_names: [
            ...(criteria.user_company_names || []),
            ...(criteria.researched_companies || []),
            ...(criteria.company_names || [])
          ].slice(0, 8),
          keywords: criteria.keywords,
          seniorities: criteria.seniorities,
          company_sizes: criteria.company_sizes,
          experience_years: criteria.experience_years,
          research_metadata: criteria.research_metadata
        };
        
        console.log('🔬 Search A criteria:', {
          titles: searchCriteriaA.title_keywords?.length || 0,
          companies: searchCriteriaA.company_names?.length || 0,
          keywords: searchCriteriaA.keywords?.length || 0,
          seniorities: searchCriteriaA.seniorities?.length || 0,
          locations: searchCriteriaA.locations?.length || 0
        });

        // Execute Search A
        const { data: apolloResponseA, error: apolloErrorA } = await supabase.functions.invoke(
          'search-apollo-candidates',
          {
            body: {
              project_id: sourcing_project_id,
              criteria: searchCriteriaA,
              limit: 100,
              max_results: 300,
              organization_id
            }
          }
        );

        let searchAResults = apolloResponseA?.candidates || [];
        let searchATotalCount = apolloResponseA?.total_count || 0;
        
        if (apolloErrorA) {
          console.warn('⚠️ Apollo Search A error:', apolloErrorA);
          if (apolloErrorA.message?.includes('credit limit')) {
            console.log('💳 Apollo credits exhausted - using local candidates only');
          }
        } else {
          console.log(`✅ Search A: ${searchAResults.length} candidates, total_count: ${searchATotalCount}`);
          creditsUsed = apolloResponseA?.credits_used || 0;
        }

        // Calculate title match rate using synonym-aware matching
        const titleMatchRate = calculateTitleMatchRate(searchAResults, searchCriteriaA.title_keywords || []);
        searchMetadata.title_match_rate = titleMatchRate;
        
        // TELEMETRY LOG
        console.log('📊 TELEMETRY: Search A', {
          project_id: sourcing_project_id,
          searchA_total_count: searchATotalCount,
          searchA_title_match_rate: titleMatchRate.toFixed(1),
          searchA_returned: searchAResults.length
        });

        // DETERMINE IF FALLBACK NEEDED
        let needsFallback = false;
        if (searchATotalCount === 0) {
          needsFallback = true;
          searchMetadata.fallback_trigger_reason = 'zero_results';
        } else if (searchATotalCount < 20 && titleMatchRate < 40) {
          needsFallback = true;
          searchMetadata.fallback_trigger_reason = 'low_quality';
        }

        let searchBResults: any[] = [];
        let searchBTotalCount = 0;

        if (needsFallback && !apolloErrorA) {
          console.log(`🔄 Triggering Search B (reason=${searchMetadata.fallback_trigger_reason})`);
          searchMetadata.search_expanded = true;
          
          // Build relaxed criteria based on trigger reason
          let searchCriteriaB = { ...searchCriteriaA };
          
          // For zero_results, also pre-broaden location if strict
          const shouldPreBroadenLocation = searchMetadata.fallback_trigger_reason === 'zero_results' && hasStrictLocation(searchCriteriaB);
          
          if (searchMetadata.fallback_trigger_reason === 'zero_results') {
            // Aggressive relaxation: drop boosters + keywords + seniorities
            if (criteria.researched_companies?.length > 0) {
              // Keep only user companies
              searchCriteriaB.company_names = criteria.user_company_names || [];
              searchMetadata.expanded_steps.push('dropped_booster_companies');
            }
            if (searchCriteriaB.keywords?.length > 0) {
              searchCriteriaB.keywords = [];
              searchMetadata.expanded_steps.push('dropped_keywords');
            }
            if (searchCriteriaB.seniorities?.length > 0 && !(criteria.user_company_names?.length > 0)) {
              searchCriteriaB.seniorities = [];
              searchMetadata.expanded_steps.push('dropped_seniorities');
            }
            
            // Pre-broaden location for zero_results with strict location
            if (shouldPreBroadenLocation) {
              const { broadened, newCriteria } = broadenLocation(searchCriteriaB);
              if (broadened) {
                searchCriteriaB = newCriteria;
                searchMetadata.expanded_steps.push('broadened_location');
              }
            }
          } else {
            // Low quality: more conservative — drop boosters only, keep keywords for relevance
            if (criteria.researched_companies?.length > 0) {
              searchCriteriaB.company_names = criteria.user_company_names || [];
              searchMetadata.expanded_steps.push('dropped_booster_companies');
            }
          }
          
          // LOG RELAXED CRITERIA SNAPSHOT (server-side only, not returned)
          console.log('📋 Relaxed criteria snapshot:', {
            titles: searchCriteriaB.title_keywords?.length || 0,
            companies: searchCriteriaB.company_names?.length || 0,
            keywords: searchCriteriaB.keywords?.length || 0,
            seniorities: searchCriteriaB.seniorities?.length || 0,
            locations: searchCriteriaB.locations
          });

          // Execute Search B
          const { data: apolloResponseB, error: apolloErrorB } = await supabase.functions.invoke(
            'search-apollo-candidates',
            {
              body: {
                project_id: sourcing_project_id,
                criteria: searchCriteriaB,
                limit: 100,
                max_results: 300,
                organization_id
              }
            }
          );

          if (!apolloErrorB && apolloResponseB?.candidates) {
            searchBResults = apolloResponseB.candidates;
            searchBTotalCount = apolloResponseB.total_count || 0;
            creditsUsed += apolloResponseB.credits_used || 0;
            console.log(`✅ Search B: ${searchBResults.length} candidates, total_count: ${searchBTotalCount}`);
          }

          // TELEMETRY LOG
          console.log('📊 TELEMETRY: Search B', {
            project_id: sourcing_project_id,
            fallback_trigger_reason: searchMetadata.fallback_trigger_reason,
            expanded_steps: searchMetadata.expanded_steps,
            searchB_total_count: searchBTotalCount
          });
        }

        // Determine winning pool size (from the search that produced results)
        const winningPoolSize = needsFallback && searchBTotalCount > 0 ? searchBTotalCount : searchATotalCount;
        searchMetadata.result_pool_size = winningPoolSize;
        searchMetadata.overflow_warning = winningPoolSize > 500;

        // Merge and deduplicate Apollo candidates (A + B)
        const apolloIdsSeen = new Set<string>();
        const mergedApolloRaw: any[] = [];
        
        // Add Search A results first (higher priority)
        for (const c of searchAResults) {
          if (c.apollo_id && !apolloIdsSeen.has(c.apollo_id)) {
            apolloIdsSeen.add(c.apollo_id);
            mergedApolloRaw.push(c);
          }
        }
        
        // Add Search B results
        for (const c of searchBResults) {
          if (c.apollo_id && !apolloIdsSeen.has(c.apollo_id)) {
            apolloIdsSeen.add(c.apollo_id);
            mergedApolloRaw.push(c);
          }
        }

        // Process merged Apollo candidates
        let skippedDuplicates = 0;
        for (const apolloCandidate of mergedApolloRaw) {
          if (apolloCandidate.apollo_id && localApolloIds.has(apolloCandidate.apollo_id)) {
            skippedDuplicates++;
            continue;
          }
          
          const candidateForScoring = {
            skills: jobSkills,
            profile_summary: apolloCandidate.headline || ''
          };
          
          const candidateScore = calculateEnhancedCandidateScore(candidateForScoring, jobSkills, job);
          
          const minApolloScore = sourcing_project_id ? 25 : 40;
          
          if (candidateScore.total_score >= minApolloScore) {
            const city = apolloCandidate.city || 
                         apolloCandidate.location?.split(',')[0]?.trim() || null;
            
            const displayLocation = apolloCandidate.location || 
              [city, apolloCandidate.state, apolloCandidate.country].filter(Boolean).join(', ') || null;

            apolloCandidates.push({
              id: apolloCandidate.apollo_id,
              candidate_name: apolloCandidate.full_name,
              skills: jobSkills,
              standardized_skills: jobSkills,
              location_country: apolloCandidate.country,
              location_city: city,
              location_state: apolloCandidate.state,
              location: displayLocation,
              linkedin_url: apolloCandidate.linkedin_url || apolloCandidate.profile_url,
              match_score: candidateScore.total_score,
              match_tier: getMatchTier(candidateScore.total_score),
              profile_summary: apolloCandidate.headline,
              source: 'apollo',
              years_experience: apolloCandidate.experience_count || 0,
              current_company: apolloCandidate.current_company,
              current_role: apolloCandidate.current_title,
              score_breakdown: candidateScore,
              competitive_advantage: [],
              apollo_id: apolloCandidate.apollo_id,
              apollo_score: apolloCandidate._score,
              headline: apolloCandidate.headline,
              email: apolloCandidate.email,
              email_status: apolloCandidate.email_status,
              phone: apolloCandidate.phone,
              has_email: apolloCandidate.has_email,
              has_phone: apolloCandidate.has_phone,
              candidate_id: null
            });
          }
        }
        
        if (skippedDuplicates > 0) {
          console.log(`🔄 Deduplicated ${skippedDuplicates} Apollo candidates (already in local DB)`);
        }
        console.log(`📊 Added ${apolloCandidates.length} quality Apollo matches`);
        
        searchMetadata.returned_count = matchedCandidates.length + apolloCandidates.length;

        // Final telemetry log
        console.log('📊 TELEMETRY: Final', {
          project_id: sourcing_project_id,
          result_pool_size: searchMetadata.result_pool_size,
          returned_count: searchMetadata.returned_count,
          local_count: matchedCandidates.length,
          apollo_count: apolloCandidates.length,
          search_expanded: searchMetadata.search_expanded,
          expanded_steps: searchMetadata.expanded_steps
        });

      } catch (error) {
        console.error('❌ Unexpected error in Apollo search:', error);
      }
    } else {
      console.warn(`⚠️ Apollo search skipped: count_only=${count_only}, has_org_id=${!!organization_id}, skills_count=${jobSkills.length}`);
    }

    // Merge local and Apollo candidates
    const allCandidates = [...matchedCandidates, ...apolloCandidates];

    // Apply location filter
    const hasLocationInCriteria = criteria?.location || (criteria?.locations && criteria.locations.length > 0);
    
    if (!filters && job.location && hasLocationInCriteria && !sourcing_project_id) {
      filters = { location: job.location };
      console.log(`🗺️ Auto-applying location filter from job: ${job.location}`);
    } else if (!filters || sourcing_project_id) {
      console.log(`🌍 ${sourcing_project_id ? 'Sourcing' : 'Global'} search - no location filter applied`);
    }

    // Apply additional filters
    let filteredCandidates = allCandidates;

    if (filters) {
      if (filters.match_tier && filters.match_tier.length > 0) {
        filteredCandidates = filteredCandidates.filter(c => 
          filters.match_tier!.includes(c.match_tier)
        );
        console.log(`🔍 Filtered by match tier: ${filteredCandidates.length} remaining`);
      }
      
      if (filters.location) {
        const locationLower = filters.location.toLowerCase().trim();
        const beforeFilterCount = filteredCandidates.length;
        filteredCandidates = filteredCandidates.filter(c => {
          const country = (c.location_country || '').toLowerCase();
          const city = (c.location_city || '').toLowerCase();
          
          return country.includes(locationLower) || 
                 locationLower.includes(country) ||
                 city.includes(locationLower) ||
                 locationLower.includes(city);
        });
        console.log(`🗺️ Location filter "${filters.location}": ${filteredCandidates.length} candidates remaining (from ${beforeFilterCount})`);
      }
      
      if (filters.min_experience !== undefined) {
        filteredCandidates = filteredCandidates.filter(c => 
          (c.years_experience || 0) >= filters.min_experience!
        );
      }
      
      if (filters.max_experience !== undefined) {
        filteredCandidates = filteredCandidates.filter(c => 
          (c.years_experience || 0) <= filters.max_experience!
        );
      }
    }

    // Calculate relevance scores and sort
    for (const candidate of filteredCandidates) {
      candidate.relevance_score = calculateRelevanceScore(candidate, criteria);
    }

    // Sort by relevance score (primary) and match score (secondary)
    filteredCandidates.sort((a, b) => {
      const relevanceDiff = (b.relevance_score || 0) - (a.relevance_score || 0);
      if (relevanceDiff !== 0) return relevanceDiff;
      
      const scoreA = a.match_score * (a.score_breakdown?.confidence || 50) / 100;
      const scoreB = b.match_score * (b.score_breakdown?.confidence || 50) / 100;
      return scoreB - scoreA;
    });

    // Perform comparative analysis
    const analyzedCandidates = performComparativeAnalysis(filteredCandidates);

    // Limit results
    const maxResults = sourcing_project_id ? 500 : 50;
    const effectiveLimit = Math.min(limit, maxResults);
    const limitedCandidates = analyzedCandidates.slice(0, effectiveLimit);

    // Update returned count after all filtering
    searchMetadata.returned_count = limitedCandidates.length;

    const result: JobMatchingResult = {
      candidates: limitedCandidates,
      total_count: allCandidates.length,
      breakdown: {
        localCandidates: matchedCandidates.length,
        apolloCandidates: apolloCandidates.length,
        averageMatch: allCandidates.length > 0 
          ? allCandidates.reduce((sum, c) => sum + c.match_score, 0) / allCandidates.length 
          : 0,
        creditsUsed: creditsUsed
      },
      search_metadata: searchMetadata
    };

    console.log(`✅ Enhanced matching complete: ${limitedCandidates.length} candidates from ${result.breakdown.localCandidates} local + ${result.breakdown.apolloCandidates} Apollo (avg: ${result.breakdown.averageMatch.toFixed(1)}%)`);
    console.log(`📊 Quality metrics: ${limitedCandidates.filter(c => c.match_tier === 'excellent').length} excellent, ${limitedCandidates.filter(c => c.match_tier === 'good').length} good matches`);
    if (creditsUsed > 0) {
      console.log(`💳 Apollo credits used: ${creditsUsed}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in get-job-matching-candidates function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
