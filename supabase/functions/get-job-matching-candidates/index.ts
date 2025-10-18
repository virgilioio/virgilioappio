import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
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

// CoreSignal integration removed

interface JobMatchingRequest {
  job_id: string;
  limit?: number;
  count_only?: boolean;
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
  source: 'local';
  years_experience?: number;
  enriched_at?: string;
  current_company?: string;
  current_role?: string;
  score_breakdown?: CandidateScore;
  competitive_advantage?: string[];
}

interface JobMatchingResult {
  candidates: MatchedCandidate[];
  total_count: number;
  breakdown: {
    localCandidates: number;
    averageMatch: number;
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
    const { job_id, limit = 50, count_only = false }: JobMatchingRequest = await req.json();

    console.log(`🎯 Finding matching candidates for job: ${job_id}${count_only ? ' (count only)' : ''}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, skills, standardized_skills, location, salary_min, salary_max, currency')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message || 'Unknown error'}`);
    }

    const jobSkills = job.standardized_skills || job.skills || [];
    console.log(`📋 Job skills: ${jobSkills.join(', ')}`);

    // Get existing candidate associations for this job to exclude them
    const { data: existingAssociations, error: associationsError } = await supabase
      .from('job_candidate_associations')
      .select('candidate_id')
      .eq('job_id', job_id);

    if (associationsError) {
      console.warn('Error fetching existing associations:', associationsError);
    }

    const existingCandidateIds = new Set(
      existingAssociations?.map(assoc => assoc.candidate_id) || []
    );
    console.log(`🚫 Excluding ${existingCandidateIds.size} already associated candidates`);

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

    const { data: localCandidates, error: localError } = await supabase
      .from('candidates')
      .select(candidateFields)
      .limit(limit * 3); // Increased limit to account for filtering

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
        
        // Only include candidates with meaningful match scores (raised threshold for quality)
        if (candidateScore.total_score >= 30 && candidateScore.confidence >= 40) {
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

    // CoreSignal integration removed - only using local candidates

    // Perform comparative analysis
    const analyzedCandidates = performComparativeAnalysis(matchedCandidates);
    
    // Sort by enhanced scoring (confidence-weighted score)
    analyzedCandidates.sort((a, b) => {
      const scoreA = a.match_score * (a.score_breakdown?.confidence || 50) / 100;
      const scoreB = b.match_score * (b.score_breakdown?.confidence || 50) / 100;
      return scoreB - scoreA;
    });

    // Limit results
    const limitedCandidates = analyzedCandidates.slice(0, limit);

    const result: JobMatchingResult = {
      candidates: limitedCandidates,
      total_count: matchedCandidates.length,
      breakdown: {
        localCandidates: matchedCandidates.length,
        averageMatch: matchedCandidates.length > 0 
          ? matchedCandidates.reduce((sum, c) => sum + c.match_score, 0) / matchedCandidates.length 
          : 0,
      }
    };

    console.log(`✅ Enhanced matching complete: ${limitedCandidates.length} candidates (avg: ${result.breakdown.averageMatch.toFixed(1)}%)`);
    console.log(`📊 Quality metrics: ${limitedCandidates.filter(c => c.match_tier === 'excellent').length} excellent, ${limitedCandidates.filter(c => c.match_tier === 'good').length} good matches`);

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