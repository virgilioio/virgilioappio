import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const CORESIGNAL_API_KEY = Deno.env.get('CORESIGNAL_API_KEY');
const CORESIGNAL_BASE_URL = 'https://api.coresignal.com';

interface JobMatchingRequest {
  job_id: string;
  limit?: number;
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
  source: 'local' | 'coresignal';
  years_experience?: number;
  enriched_at?: string;
  current_company?: string;
  current_role?: string;
}

interface JobMatchingResult {
  candidates: MatchedCandidate[];
  total_count: number;
  breakdown: {
    localCandidates: number;
    coreSignalCandidates: number;
    averageMatch: number;
  };
}

// Reuse the skill matching logic from count-matching-candidates
const SKILL_SYNONYMS: Record<string, string[]> = {
  'sales development representative': ['sdr', 'sales development', 'sales rep', 'sales representative', 'bdr', 'business development representative'],
  'javascript': ['js', 'javascript', 'ecmascript', 'node.js', 'nodejs'],
  'react': ['reactjs', 'react.js', 'react native'],
  'python': ['py', 'python3', 'python 3'],
  'customer success': ['cs', 'customer support', 'client success'],
  'project management': ['pm', 'project manager', 'program management'],
  'business development': ['bd', 'biz dev', 'business dev', 'bdr'],
  'machine learning': ['ml', 'artificial intelligence', 'ai', 'deep learning'],
  'data science': ['data scientist', 'data analysis', 'analytics'],
  'full stack': ['fullstack', 'full-stack', 'frontend and backend'],
  'devops': ['dev ops', 'infrastructure', 'site reliability'],
  'quality assurance': ['qa', 'testing', 'test automation'],
  'user experience': ['ux', 'user interface', 'ui', 'ui/ux'],
  'software engineer': ['software developer', 'developer', 'engineer', 'programmer'],
  'marketing': ['digital marketing', 'growth marketing', 'content marketing'],
  'account management': ['account manager', 'key account', 'client management'],
  'human resources': ['hr', 'people operations', 'talent acquisition'],
  'cold calling': ['outbound calling', 'prospecting calls', 'sales calls'],
  'lead generation': ['lead gen', 'prospecting', 'lead qualification']
};

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function getSkillWords(skill: string): string[] {
  return normalizeSkill(skill).split(' ').filter(word => word.length > 2);
}

function findSkillSynonyms(skill: string): string[] {
  const normalized = normalizeSkill(skill);
  
  if (SKILL_SYNONYMS[normalized]) {
    return SKILL_SYNONYMS[normalized];
  }
  
  for (const [key, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return [key, ...synonyms.filter(s => s !== normalized)];
    }
  }
  
  return [];
}

function extractSkillsFromSummary(summary: string): string[] {
  if (!summary) return [];
  
  const skillKeywords = [
    'sales development representative', 'sdr', 'business development', 'bdr',
    'sales', 'marketing', 'management', 'engineer', 'developer', 'designer', 'analyst',
    'javascript', 'python', 'react', 'node', 'sql', 'aws', 'google', 'microsoft',
    'crm', 'salesforce', 'hubspot', 'excel', 'powerbi', 'tableau', 'jira',
    'recruiting', 'hr', 'human resources', 'onboarding', 'training', 'payroll',
    'customer service', 'support', 'account management', 'cold calling',
    'project management', 'agile', 'scrum', 'digital marketing', 'seo', 'sem',
    'accounting', 'finance', 'operations', 'logistics', 'supply chain',
    'lead generation', 'prospecting', 'outbound', 'inbound', 'qualification'
  ];
  
  const cleanSummary = summary.toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^\w\s]/g, ' ');
  const extractedSkills: string[] = [];
  
  for (const keyword of skillKeywords) {
    if (cleanSummary.includes(keyword)) {
      extractedSkills.push(keyword);
    }
  }
  
  return [...new Set(extractedSkills)];
}

function calculateSkillMatch(jobSkills: string[], candidateSkills: string[], candidateSummary?: string): number {
  if (!jobSkills || jobSkills.length === 0) {
    return 85;
  }
  
  let skillsToMatch = candidateSkills || [];
  
  if ((!candidateSkills || candidateSkills.length === 0) && candidateSummary) {
    skillsToMatch = extractSkillsFromSummary(candidateSummary);
  }
  
  if (skillsToMatch.length === 0) {
    return candidateSummary ? 30 : 15;
  }
  
  const normalizedJobSkills = jobSkills.map(normalizeSkill);
  const normalizedCandidateSkills = skillsToMatch.map(normalizeSkill);
  
  let totalScore = 0;
  let maxPossibleScore = jobSkills.length * 100;
  
  for (const jobSkill of normalizedJobSkills) {
    let bestMatchScore = 0;
    
    for (const candidateSkill of normalizedCandidateSkills) {
      let score = 0;
      
      // Exact match
      if (jobSkill === candidateSkill) {
        score = 100;
      }
      // Substring match
      else if (candidateSkill.includes(jobSkill) || jobSkill.includes(candidateSkill)) {
        score = 80;
      }
      // Word-level match
      else {
        const jobWords = getSkillWords(jobSkill);
        const candidateWords = getSkillWords(candidateSkill);
        const wordMatches = jobWords.filter(word => candidateWords.includes(word));
        
        if (wordMatches.length > 0) {
          score = Math.min(70, (wordMatches.length / jobWords.length) * 70);
        }
      }
      
      // Synonym match
      if (score === 0) {
        const jobSynonyms = findSkillSynonyms(jobSkill);
        const candidateSynonyms = findSkillSynonyms(candidateSkill);
        
        if (jobSynonyms.includes(candidateSkill) || candidateSynonyms.includes(jobSkill)) {
          score = 60;
        } else {
          for (const synonym of jobSynonyms) {
            if (candidateSkill.includes(synonym) || synonym.includes(candidateSkill)) {
              score = Math.max(score, 50);
              break;
            }
          }
        }
      }
      
      if (score > bestMatchScore) {
        bestMatchScore = score;
      }
    }
    
    totalScore += bestMatchScore;
  }
  
  const finalScore = (totalScore / maxPossibleScore) * 100;
  return Math.min(100, Math.max(0, finalScore));
}

function getMatchTier(score: number): 'excellent' | 'good' | 'fair' | 'minimal' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'minimal';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_id, limit = 50 }: JobMatchingRequest = await req.json();

    console.log(`🎯 Finding matching candidates for job: ${job_id}`);

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
    const { data: localCandidates, error: localError } = await supabase
      .from('candidates')
      .select(`
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
      `)
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
        if (existingCandidateIds.has(candidate.id)) {
          excludedCount++;
          continue;
        }

        const candidateSkills = candidate.standardized_skills || candidate.skills || [];
        const matchScore = calculateSkillMatch(jobSkills, candidateSkills, candidate.profile_summary);
        
        // Only include candidates with meaningful match scores
        if (matchScore >= 20) {
          matchedCandidates.push({
            id: candidate.id,
            candidate_name: candidate.candidate_name,
            skills: candidate.skills,
            standardized_skills: candidate.standardized_skills,
            location_country: candidate.location_country,
            location_city: candidate.location_city,
            linkedin_url: candidate.linkedin_url,
            salary_amount: candidate.salary_amount,
            salary_currency: candidate.salary_currency,
            salary_period: candidate.salary_period,
            match_score: matchScore,
            match_tier: getMatchTier(matchScore),
            profile_summary: candidate.profile_summary,
            source: 'local',
            years_experience: candidate.years_experience,
            enriched_at: candidate.enriched_at,
            current_company: candidate.company_current,
            current_role: candidate.role_current,
          });
        }
      }
      
      console.log(`📊 Filtered out ${excludedCount} already associated candidates`);
    }

    // TODO: Add CoreSignal candidates here (similar to count-matching-candidates logic)
    // For now, focusing on local candidates to get the feature working

    // Sort by match score (highest first)
    matchedCandidates.sort((a, b) => b.match_score - a.match_score);

    // Limit results
    const limitedCandidates = matchedCandidates.slice(0, limit);

    const result: JobMatchingResult = {
      candidates: limitedCandidates,
      total_count: matchedCandidates.length,
      breakdown: {
        localCandidates: matchedCandidates.filter(c => c.source === 'local').length,
        coreSignalCandidates: matchedCandidates.filter(c => c.source === 'coresignal').length,
        averageMatch: matchedCandidates.length > 0 
          ? matchedCandidates.reduce((sum, c) => sum + c.match_score, 0) / matchedCandidates.length 
          : 0,
      }
    };

    console.log(`✅ Returning ${limitedCandidates.length} matched candidates (avg score: ${result.breakdown.averageMatch.toFixed(1)}%)`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in get-job-matching-candidates function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});