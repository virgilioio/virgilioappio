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
  count_only?: boolean;
}

interface SkillAnalysis {
  skill: string;
  frequency: number;
  contexts: Array<{
    source: 'job_title' | 'description' | 'skills_list' | 'summary';
    prominence: number;
    recency?: number;
  }>;
  density_score: number;
  prominence_score: number;
  recency_score: number;
}

interface CandidateScore {
  skill_appearance: number;
  skill_density: number;
  experience_relevance: number;
  total_score: number;
  confidence: number;
  match_reasoning: string[];
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
  score_breakdown?: CandidateScore;
  competitive_advantage?: string[];
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

// Enhanced skill extraction with context analysis
function analyzeSkillsInCandidate(candidate: any, jobSkills: string[]): Map<string, SkillAnalysis> {
  const skillAnalysis = new Map<string, SkillAnalysis>();
  
  // Helper to add skill context
  const addSkillContext = (skill: string, source: string, prominence: number, recency?: number) => {
    const normalized = normalizeSkill(skill);
    if (!skillAnalysis.has(normalized)) {
      skillAnalysis.set(normalized, {
        skill: normalized,
        frequency: 0,
        contexts: [],
        density_score: 0,
        prominence_score: 0,
        recency_score: 0
      });
    }
    
    const analysis = skillAnalysis.get(normalized)!;
    analysis.frequency++;
    analysis.contexts.push({
      source: source as any,
      prominence,
      recency
    });
  };

  // Analyze skills from different sources
  const candidateSkills = candidate.skills || candidate.standardized_skills || [];
  candidateSkills.forEach((skill: string) => {
    addSkillContext(skill, 'skills_list', 90, 100); // Skills list = high prominence
  });

  // Analyze current role (highest recency)
  if (candidate.role_current) {
    const roleWords = candidate.role_current.toLowerCase().split(/\s+/);
    jobSkills.forEach(jobSkill => {
      const normalized = normalizeSkill(jobSkill);
      if (roleWords.some(word => normalized.includes(word) || word.includes(normalized))) {
        addSkillContext(jobSkill, 'job_title', 100, 100);
      }
    });
  }

  // Analyze profile summary with context weighting
  if (candidate.profile_summary) {
    const summary = candidate.profile_summary.toLowerCase();
    jobSkills.forEach(jobSkill => {
      const normalized = normalizeSkill(jobSkill);
      const matches = (summary.match(new RegExp(normalized, 'gi')) || []).length;
      if (matches > 0) {
        // Higher matches = higher density
        for (let i = 0; i < matches; i++) {
          addSkillContext(jobSkill, 'summary', 60, 80);
        }
      }
    });
  }

  // Calculate density, prominence, and recency scores
  skillAnalysis.forEach((analysis, skill) => {
    const totalContexts = analysis.contexts.length;
    analysis.density_score = Math.min(100, (analysis.frequency / totalContexts) * 100);
    analysis.prominence_score = analysis.contexts.reduce((sum, ctx) => sum + ctx.prominence, 0) / totalContexts;
    analysis.recency_score = analysis.contexts.reduce((sum, ctx) => sum + (ctx.recency || 50), 0) / totalContexts;
  });

  return skillAnalysis;
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

// Enhanced multi-dimensional scoring system
function calculateEnhancedCandidateScore(candidate: any, jobSkills: string[], job: any): CandidateScore {
  const reasoning: string[] = [];
  const skillAnalysis = analyzeSkillsInCandidate(candidate, jobSkills);
  
  // 1. Skill Appearance Score (40% weight)
  let appearanceScore = 0;
  let skillsFound = 0;
  
  for (const jobSkill of jobSkills) {
    const normalized = normalizeSkill(jobSkill);
    let bestMatch = 0;
    
    // Direct skill match
    if (skillAnalysis.has(normalized)) {
      bestMatch = 100;
      skillsFound++;
      reasoning.push(`✓ Direct match: ${jobSkill}`);
    } else {
      // Semantic/synonym matching
      for (const [candidateSkill] of skillAnalysis) {
        const synonyms = findSkillSynonyms(jobSkill);
        const candidateSynonyms = findSkillSynonyms(candidateSkill);
        
        if (synonyms.includes(candidateSkill) || candidateSynonyms.includes(normalized)) {
          bestMatch = Math.max(bestMatch, 80);
          reasoning.push(`≈ Synonym match: ${jobSkill} ↔ ${candidateSkill}`);
        } else if (candidateSkill.includes(normalized) || normalized.includes(candidateSkill)) {
          bestMatch = Math.max(bestMatch, 60);
          reasoning.push(`⊃ Partial match: ${jobSkill} ↔ ${candidateSkill}`);
        }
      }
    }
    
    appearanceScore += bestMatch;
  }
  
  appearanceScore = jobSkills.length > 0 ? (appearanceScore / jobSkills.length) : 0;
  
  // 2. Skill Density Score (35% weight)
  let densityScore = 0;
  let totalDensity = 0;
  let densityCount = 0;
  
  skillAnalysis.forEach((analysis, skill) => {
    if (jobSkills.some(js => normalizeSkill(js) === skill)) {
      totalDensity += analysis.density_score * analysis.prominence_score / 100;
      densityCount++;
      
      if (analysis.frequency > 2) {
        reasoning.push(`🔥 High frequency: ${skill} appears ${analysis.frequency} times`);
      }
    }
  });
  
  densityScore = densityCount > 0 ? (totalDensity / densityCount) : 0;
  
  // 3. Experience Relevance Score (25% weight)
  let experienceScore = 50; // Base score
  
  // Current role relevance
  if (candidate.role_current) {
    const roleScore = calculateRoleRelevance(candidate.role_current, jobSkills, job.title);
    experienceScore = Math.max(experienceScore, roleScore);
    if (roleScore > 70) {
      reasoning.push(`💼 Current role highly relevant: ${candidate.role_current}`);
    }
  }
  
  // Industry/company context
  if (candidate.company_current) {
    reasoning.push(`🏢 Currently at: ${candidate.company_current}`);
  }
  
  // Experience level alignment
  if (candidate.years_experience) {
    const expAlignment = calculateExperienceAlignment(candidate.years_experience);
    experienceScore = (experienceScore + expAlignment) / 2;
    reasoning.push(`📅 ${candidate.years_experience} years experience`);
  }
  
  // Calculate weighted total score
  const weightedScore = (
    (appearanceScore * 0.40) + 
    (densityScore * 0.35) + 
    (experienceScore * 0.25)
  );
  
  // Calculate confidence based on data completeness
  let confidence = 0;
  if (candidate.skills?.length > 0) confidence += 30;
  if (candidate.profile_summary) confidence += 25;
  if (candidate.role_current) confidence += 25;
  if (candidate.years_experience) confidence += 20;
  
  return {
    skill_appearance: Math.round(appearanceScore),
    skill_density: Math.round(densityScore),
    experience_relevance: Math.round(experienceScore),
    total_score: Math.round(weightedScore),
    confidence: Math.round(confidence),
    match_reasoning: reasoning
  };
}

function calculateRoleRelevance(currentRole: string, jobSkills: string[], jobTitle: string): number {
  const roleWords = currentRole.toLowerCase().split(/\s+/);
  const titleWords = jobTitle.toLowerCase().split(/\s+/);
  
  let relevanceScore = 0;
  
  // Direct title similarity
  const titleOverlap = titleWords.filter(word => roleWords.includes(word)).length;
  relevanceScore += (titleOverlap / titleWords.length) * 40;
  
  // Skills mentioned in role
  const skillMentions = jobSkills.filter(skill => 
    currentRole.toLowerCase().includes(normalizeSkill(skill))
  ).length;
  relevanceScore += (skillMentions / jobSkills.length) * 60;
  
  return Math.min(100, relevanceScore);
}

function calculateExperienceAlignment(yearsExp: number): number {
  // Assume ideal range is 2-8 years for most roles
  if (yearsExp >= 2 && yearsExp <= 8) return 100;
  if (yearsExp >= 1 && yearsExp <= 10) return 80;
  if (yearsExp >= 0 && yearsExp <= 15) return 60;
  return 40;
}

// Legacy function for backward compatibility
function calculateSkillMatch(jobSkills: string[], candidateSkills: string[], candidateSummary?: string): number {
  // Create a simplified candidate object for the enhanced scoring
  const mockCandidate = {
    skills: candidateSkills,
    profile_summary: candidateSummary
  };
  
  const mockJob = { title: 'Generic Position' };
  const score = calculateEnhancedCandidateScore(mockCandidate, jobSkills, mockJob);
  return score.total_score;
}

function getMatchTier(score: number): 'excellent' | 'good' | 'fair' | 'minimal' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'minimal';
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
        if (existingCandidateIds.has(candidate.id)) {
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
              id: candidate.id,
              match_score: candidateScore.total_score,
              match_tier: getMatchTier(candidateScore.total_score),
              source: 'local'
            } as any);
          } else {
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
              match_score: candidateScore.total_score,
              match_tier: getMatchTier(candidateScore.total_score),
              profile_summary: candidate.profile_summary,
              source: 'local',
              years_experience: candidate.years_experience,
              enriched_at: candidate.enriched_at,
              current_company: candidate.company_current,
              current_role: candidate.role_current,
              score_breakdown: candidateScore,
              competitive_advantage: [] // Will be populated in comparative analysis
            });
          }
        }
      }
      
      console.log(`📊 Filtered out ${excludedCount} already associated candidates`);
    }

    // TODO: Add CoreSignal candidates here (similar to count-matching-candidates logic)
    // For now, focusing on local candidates to get the feature working

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
        localCandidates: matchedCandidates.filter(c => c.source === 'local').length,
        coreSignalCandidates: matchedCandidates.filter(c => c.source === 'coresignal').length,
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});