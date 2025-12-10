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

// Apollo.io integration enabled - searches external candidates when credits available

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
  title_keywords?: string[];
  experience_years?: {
    min?: number;
    max?: number;
  };
}

interface MatchedCandidate {
  id: string;
  candidate_name: string;
  skills?: string[];
  standardized_skills?: string[];
  location_country?: string;
  location_city?: string;
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
  // Apollo-specific fields
  apollo_id?: string;
  apollo_score?: number;
  headline?: string;
  email?: string;
  email_status?: string;
  phone?: string;
  candidate_id?: string | null; // Null if not collected yet
  // Apollo availability indicators (teaser info)
  has_email?: boolean;
  has_phone?: boolean;
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
}

// Legacy function for backward compatibility
function calculateSkillMatch(jobSkills: string[], candidateSkills: string[], candidateSummary?: string): number {
  const mockCandidate = {
    skills: candidateSkills,
    profile_summary: candidateSummary
  };

  const mockJob = { title: 'Generic Position' };
  const score = calculateEnhancedCandidateScore(mockCandidate, jobSkills, mockJob);
  return score.total_score;
}

// Enhanced comparative analysis
function performComparativeAnalysis(candidates: MatchedCandidate[]): MatchedCandidate[] {
  if (candidates.length < 2) return candidates;
  
  // Group candidates by experience level for fair comparison
  const experienceGroups = new Map<string, MatchedCandidate[]>();
  
  candidates.forEach(candidate => {
    const expGroup = getExperienceGroup(candidate.years_experience || 0);
    if (!experienceGroups.has(expGroup)) {
      experienceGroups.set(expGroup, []);
    }
    experienceGroups.get(expGroup)!.push(candidate);
  });
  
  // Identify competitive advantages within each group
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
  
  // Higher match score than peers
  const avgPeerScore = peers.filter(p => p.id !== candidate.id)
    .reduce((sum, p) => sum + p.match_score, 0) / (peers.length - 1);
  
  if (candidate.match_score > avgPeerScore + 10) {
    advantages.push('Higher skill match than peers');
  }
  
  // Current role advantage
  if (candidate.current_role && candidate.current_role.toLowerCase().includes('senior') || 
      candidate.current_role?.toLowerCase().includes('lead')) {
    advantages.push('Leadership experience in current role');
  }
  
  // Skills breadth advantage
  const skillCount = candidate.skills?.length || 0;
  const avgPeerSkills = peers.filter(p => p.id !== candidate.id)
    .reduce((sum, p) => sum + (p.skills?.length || 0), 0) / (peers.length - 1);
    
  if (skillCount > avgPeerSkills + 3) {
    advantages.push('Broader skill set than peers');
  }
  
  return advantages;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      job_id, 
      sourcing_project_id,
      criteria: providedCriteria,
      limit = 200, // Increased for sourcing projects 
      count_only = false,
      filters: requestFilters
    }: JobMatchingRequest = await req.json();

    let filters = requestFilters;

    let jobSkills: string[] = [];
    let job: any = null;
    let organization_id: string | null = null;
    let tenant_id: string | null = null;
    let criteria: any = null;

    // Option 1: Load from sourcing project
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
      
      // Extract criteria from project (use provided criteria if available for refresh)
      criteria = providedCriteria || (project.search_criteria as any);
      
      // Ensure skills are properly extracted from criteria (defensive)
      jobSkills = Array.isArray(criteria?.skills) ? criteria.skills : [];

      // If still empty, try to extract from nested search_criteria (defensive)
      if (jobSkills.length === 0 && project && project.search_criteria) {
        const projectCriteria = typeof project.search_criteria === 'string' 
          ? JSON.parse(project.search_criteria)  
          : project.search_criteria;
        jobSkills = Array.isArray(projectCriteria?.skills) ? projectCriteria.skills : [];
      }

      console.log(`🐛 DEBUG: organization_id=${organization_id}, count_only=${count_only}, jobSkills.length=${jobSkills.length}, jobSkills=${JSON.stringify(jobSkills.slice(0, 3))}${jobSkills.length > 3 ? '...' : ''}`);
      organization_id = project.organization_id;
      tenant_id = project.organizations?.tenant_id || null;
      
      // Extract location correctly - handle both array and scalar formats
      const locationValue = criteria.locations?.[0] || criteria.location || undefined;
      
      // If project is linked to a job, use job details for additional context
      if (project.job_id && project.jobs) {
        job = project.jobs;
        // Merge in title_keywords from criteria since jobs table doesn't have this field
        job.title_keywords = criteria.title_keywords;
        console.log(`📋 Linked job: ${job.title}`);
      } else {
        // Create a mock job object for standalone projects
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
      
      // Update project's last_search_at timestamp
      await supabase
        .from('sourcing_projects')
        .update({ last_search_at: new Date().toISOString() })
        .eq('id', sourcing_project_id);
    }
    // Option 2: Load from job (existing behavior)
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
      
      // Set criteria for job_id path
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

    // Get existing candidate associations to exclude them
    // Only if we have a job_id (sourcing projects may not be linked to jobs yet)
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

    // Get local candidates (independent candidates table) - increased limit for filtering
    const candidateFields = count_only ? 'id, standardized_skills, skills, profile_summary' : `
      id,
      candidate_name,
      skills,
      standardized_skills,
      location_country,
      location_city,
      linkedin_url,
      salary_amount,
      salary_currency,
      salary_period,
      profile_summary,
      years_experience,
      enriched_at,
      company_current,
      role_current
    `;

    // CRITICAL: Filter by tenant_id for tenant isolation
    if (!tenant_id) {
      throw new Error('Unable to determine tenant_id - data isolation required');
    }

    console.log(`🔒 Filtering candidates by tenant: ${tenant_id}`);

    const { data: localCandidates, error: localError } = await supabase
      .from('candidates')
      .select(candidateFields)
      .eq('tenant_id', tenant_id)
      .is('deleted_at', null)
      .limit(1000); // Fetch all candidates for sourcing projects (up to 1000)

    if (localError) {
      console.warn('Error fetching local candidates:', localError);
    }

    const matchedCandidates: MatchedCandidate[] = [];

    // Process local candidates
    if (localCandidates) {
      console.log(`🔍 Processing ${localCandidates.length} local candidates`);
      let excludedCount = 0;
      
      for (const candidate of localCandidates) {
        // Skip candidates already associated with this job
        if (existingCandidateIds.has((candidate as any).id)) {
          excludedCount++;
          continue;
        }

        // Use enhanced scoring system
        const candidateScore = calculateEnhancedCandidateScore(candidate, jobSkills, job);
        
        // For sourcing projects, use lower thresholds to maximize curated results
        const minScore = sourcing_project_id ? 20 : 30;
        const minConfidence = sourcing_project_id ? 25 : 40;
        
        // Only include candidates with meaningful match scores
        if (candidateScore.total_score >= minScore && candidateScore.confidence >= minConfidence) {
          if (count_only) {
            // For count-only requests, just track the match without full candidate data
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
              competitive_advantage: [] // Will be populated in comparative analysis
            });
          }
        }
      }
      
      console.log(`📊 Filtered out ${excludedCount} already associated candidates`);
    }

    // Apollo.io integration - search for additional candidates
    let apolloCandidates: MatchedCandidate[] = [];
    let creditsUsed = 0;
    
    if (!count_only && organization_id && jobSkills.length > 0) {
      try {
        console.log(`🔍 Searching Apollo for additional candidates with ${jobSkills.length} skills...`);
        
        // Build search criteria from job or provided criteria
        // For sourcing projects, prefer criteria.locations over job.location
        const locationToUse = sourcing_project_id && criteria.locations?.[0] 
          ? criteria.locations[0] 
          : (criteria.location || job.location);
        
        const searchCriteria: any = providedCriteria || {
          skills: jobSkills,
          location: locationToUse,
          locations: criteria.locations,  // Pass full locations array for multi-location support
          title_keywords: job.title_keywords || criteria.title_keywords,
          salary_min: criteria.salary_min || job.salary_min,
          salary_max: criteria.salary_max || job.salary_max
        };

        // Call search-apollo-candidates edge function
        const { data: apolloResponse, error: apolloError } = await supabase.functions.invoke(
          'search-apollo-candidates',
          {
            body: {
              project_id: sourcing_project_id,
              criteria: searchCriteria,
              limit: 100, // Apollo supports up to 100 per page
              organization_id
            }
          }
        );

        if (apolloError) {
          // Log error but don't fail the entire request
          console.warn('⚠️ Apollo search error:', apolloError);
          
          // Check if it's a credit exhaustion error
          if (apolloError.message?.includes('credit limit')) {
            console.log('💳 Apollo credits exhausted - using local candidates only');
          }
        } else if (apolloResponse?.candidates) {
          console.log(`✅ Found ${apolloResponse.candidates.length} Apollo candidates`);
          creditsUsed = apolloResponse.credits_used || 0;
          
          // Map Apollo candidates to MatchedCandidate format
          for (const apolloCandidate of apolloResponse.candidates) {
            // Calculate match score using enhanced scoring
            const candidateForScoring = {
              skills: jobSkills, // Apollo candidates are pre-filtered by skills
              profile_summary: apolloCandidate.headline || ''
            };
            
            const candidateScore = calculateEnhancedCandidateScore(candidateForScoring, jobSkills, job);
            
            // Apollo candidates are pre-filtered by API, use lower threshold
            const minApolloScore = sourcing_project_id ? 25 : 40;
            
            // Add to results
            if (candidateScore.total_score >= minApolloScore) {
              apolloCandidates.push({
                id: apolloCandidate.apollo_id,
                candidate_name: apolloCandidate.full_name,
                skills: jobSkills,
                standardized_skills: jobSkills,
                location_country: apolloCandidate.country,
                location_city: apolloCandidate.city,  // Fixed: use .city not .location
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
                candidate_id: null // Not collected yet
              });
            }
          }
          
          console.log(`📊 Added ${apolloCandidates.length} quality Apollo matches`);
        }
      } catch (error) {
        console.error('❌ Unexpected error calling Apollo:', error);
        // Continue with local candidates only
      }
    } else {
      // Log why Apollo was skipped
      console.warn(`⚠️ Apollo search skipped: count_only=${count_only}, has_org_id=${!!organization_id}, skills_count=${jobSkills.length}`);
    }

    // Merge local and Apollo candidates
    const allCandidates = [...matchedCandidates, ...apolloCandidates];

    // Automatically apply location filter from job ONLY if:
    // 1. No explicit filters provided
    // 2. Search criteria exists with a location (not explicitly removed)
    // 3. Job has a location
    // 4. NOT a sourcing project (sourcing projects should show all matches)
    const hasLocationInCriteria = criteria?.location || (criteria?.locations && criteria.locations.length > 0);
    
    // For sourcing projects, don't auto-apply location filter (let users see all matches)
    // For job matching, auto-apply location filter for relevance
    if (!filters && job.location && hasLocationInCriteria && !sourcing_project_id) {
      filters = { location: job.location };
      console.log(`🗺️ Auto-applying location filter from job: ${job.location}`);
    } else if (!filters || sourcing_project_id) {
      console.log(`🌍 ${sourcing_project_id ? 'Sourcing' : 'Global'} search - no location filter applied`);
    }

    // Apply additional filters if provided
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
          
          // Check if location matches country or city (bidirectional)
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
        console.log(`🔍 Filtered by min experience ${filters.min_experience}y: ${filteredCandidates.length} remaining`);
      }
      
      if (filters.max_experience !== undefined) {
        filteredCandidates = filteredCandidates.filter(c => 
          (c.years_experience || 0) <= filters.max_experience!
        );
        console.log(`🔍 Filtered by max experience ${filters.max_experience}y: ${filteredCandidates.length} remaining`);
      }
    }

    // Perform comparative analysis on filtered results
    const analyzedCandidates = performComparativeAnalysis(filteredCandidates);
    
    // Sort by enhanced scoring (confidence-weighted score)
    analyzedCandidates.sort((a, b) => {
      const scoreA = a.match_score * (a.score_breakdown?.confidence || 50) / 100;
      const scoreB = b.match_score * (b.score_breakdown?.confidence || 50) / 100;
      return scoreB - scoreA;
    });

    // Limit results - for sourcing projects, return more candidates (up to 200)
    // For job matching, keep it focused (up to 50)
    const maxResults = sourcing_project_id ? 200 : 50;
    const effectiveLimit = Math.min(limit, maxResults);
    const limitedCandidates = analyzedCandidates.slice(0, effectiveLimit);

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
      }
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