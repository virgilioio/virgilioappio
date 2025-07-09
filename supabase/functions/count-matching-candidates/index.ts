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

interface MatchingCriteria {
  skills?: string[];
  location?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  salary_period?: 'monthly' | 'annual';
}

interface MatchResult {
  totalCandidates: number;
  excellent: number; // 90-100% skill match
  good: number;      // 70-89% skill match
  fair: number;      // 50-69% skill match
  minimal: number;   // 20-49% skill match
  breakdown: {
    salaryMatches: number;
    locationMatches: number;
    skillsAnalysis: {
      averageMatch: number;
      topSkills: string[];
    };
  };
}

// Skill synonyms and variations mapping
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
  'account management': ['account manager', 'key account', 'client management']
};

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

function getSkillWords(skill: string): string[] {
  return normalizeSkill(skill).split(' ').filter(word => word.length > 2);
}

function findSkillSynonyms(skill: string): string[] {
  const normalized = normalizeSkill(skill);
  
  // Check if skill is in synonyms as key
  if (SKILL_SYNONYMS[normalized]) {
    return SKILL_SYNONYMS[normalized];
  }
  
  // Check if skill is in synonyms as value
  for (const [key, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return [key, ...synonyms.filter(s => s !== normalized)];
    }
  }
  
  return [];
}

// Currency conversion rates (approximate)
const CURRENCY_RATES: Record<string, number> = {
  'USD': 1,
  'MXN': 18,
  'BRL': 5,
  'COP': 4000,
  'EUR': 0.85,
  'GBP': 0.75,
  'ARS': 800,
  'CLP': 800,
  'PEN': 3.5
};

function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;
  
  const fromRate = CURRENCY_RATES[fromCurrency] || 1;
  const toRate = CURRENCY_RATES[toCurrency] || 1;
  
  // Convert to USD first, then to target currency
  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
}

function normalizeSalaryToAnnual(amount: number, period: string): number {
  switch (period.toLowerCase()) {
    case 'monthly':
      return amount * 12;
    case 'annual':
    case 'yearly':
      return amount;
    case 'hourly':
      return amount * 40 * 52; // 40 hours/week * 52 weeks
    default:
      return amount;
  }
}

function calculateSkillMatch(jobSkills: string[], candidateSkills: string[]): number {
  if (!jobSkills || !candidateSkills || jobSkills.length === 0 || candidateSkills.length === 0) {
    return 0;
  }
  
  const normalizedJobSkills = jobSkills.map(normalizeSkill);
  const normalizedCandidateSkills = candidateSkills.map(normalizeSkill);
  
  let totalScore = 0;
  let maxPossibleScore = jobSkills.length * 100; // 100 points per job skill
  
  console.log(`🔍 Matching job skills: [${normalizedJobSkills.join(', ')}]`);
  console.log(`🎯 Against candidate skills: [${normalizedCandidateSkills.join(', ')}]`);
  
  for (const jobSkill of normalizedJobSkills) {
    let bestMatchScore = 0;
    let matchDetails = '';
    
    for (const candidateSkill of normalizedCandidateSkills) {
      let score = 0;
      
      // 1. Exact match (100 points)
      if (jobSkill === candidateSkill) {
        score = 100;
        matchDetails = `exact match`;
      }
      // 2. Substring match (80 points)
      else if (candidateSkill.includes(jobSkill) || jobSkill.includes(candidateSkill)) {
        score = 80;
        matchDetails = `substring match`;
      }
      // 3. Word-level match (70 points)
      else {
        const jobWords = getSkillWords(jobSkill);
        const candidateWords = getSkillWords(candidateSkill);
        const wordMatches = jobWords.filter(word => candidateWords.includes(word));
        
        if (wordMatches.length > 0) {
          score = Math.min(70, (wordMatches.length / jobWords.length) * 70);
          matchDetails = `word match (${wordMatches.join(', ')})`;
        }
      }
      
      // 4. Synonym match (60 points)
      if (score === 0) {
        const jobSynonyms = findSkillSynonyms(jobSkill);
        const candidateSynonyms = findSkillSynonyms(candidateSkill);
        
        if (jobSynonyms.includes(candidateSkill) || candidateSynonyms.includes(jobSkill)) {
          score = 60;
          matchDetails = `synonym match`;
        }
        // Check synonym word matches
        else {
          for (const synonym of jobSynonyms) {
            if (candidateSkill.includes(synonym) || synonym.includes(candidateSkill)) {
              score = Math.max(score, 50);
              matchDetails = `synonym substring match`;
              break;
            }
          }
        }
      }
      
      if (score > bestMatchScore) {
        bestMatchScore = score;
        if (score > 0) {
          console.log(`  ✅ "${jobSkill}" → "${candidateSkill}": ${score}% (${matchDetails})`);
        }
      }
    }
    
    totalScore += bestMatchScore;
    if (bestMatchScore === 0) {
      console.log(`  ❌ "${jobSkill}": no match found`);
    }
  }
  
  const finalScore = (totalScore / maxPossibleScore) * 100;
  console.log(`📊 Final skill match: ${finalScore.toFixed(1)}% (${totalScore}/${maxPossibleScore})`);
  
  return finalScore;
}

function checkSalaryCompatibility(
  jobMin?: number, 
  jobMax?: number, 
  candidateSalary?: number,
  jobCurrency?: string,
  candidateCurrency?: string,
  jobSalaryPeriod?: string,
  candidateSalaryPeriod?: string
): boolean {
  if (!candidateSalary) return true; // No salary requirement from candidate
  if (!jobMin && !jobMax) return true; // No salary range specified in job
  
  console.log(`💰 Salary comparison: Job: ${jobMin}-${jobMax} ${jobCurrency}/${jobSalaryPeriod}, Candidate: ${candidateSalary} ${candidateCurrency}/${candidateSalaryPeriod}`);
  
  // Normalize all salaries to annual in USD for comparison
  const normalizedJobMin = jobMin ? convertCurrency(normalizeSalaryToAnnual(jobMin, jobSalaryPeriod || 'annual'), jobCurrency || 'USD', 'USD') : 0;
  const normalizedJobMax = jobMax ? convertCurrency(normalizeSalaryToAnnual(jobMax, jobSalaryPeriod || 'annual'), jobCurrency || 'USD', 'USD') : Number.MAX_SAFE_INTEGER;
  const normalizedCandidateSalary = convertCurrency(normalizeSalaryToAnnual(candidateSalary, candidateSalaryPeriod || 'annual'), candidateCurrency || 'USD', 'USD');
  
  console.log(`💰 Normalized comparison: Job: ${normalizedJobMin}-${normalizedJobMax} USD/annual, Candidate: ${normalizedCandidateSalary} USD/annual`);
  
  // Allow 20% flexibility in salary expectations
  const flexibilityFactor = 1.2;
  const adjustedCandidateSalary = normalizedCandidateSalary / flexibilityFactor;
  
  const isCompatible = adjustedCandidateSalary <= normalizedJobMax && normalizedCandidateSalary >= normalizedJobMin * 0.8;
  console.log(`💰 Salary compatibility: ${isCompatible ? '✅' : '❌'}`);
  
  return isCompatible;
}

function checkLocationCompatibility(jobLocation?: string, candidateLocation?: string): boolean {
  if (!jobLocation) return true; // No location requirement
  if (!candidateLocation) return true; // No location specified by candidate
  
  const jobLoc = jobLocation.toLowerCase().trim();
  const candidateLoc = candidateLocation.toLowerCase().trim();
  
  // Check for remote keywords
  if (jobLoc.includes('remote') || jobLoc.includes('anywhere')) return true;
  
  // Check for country/state/city matches
  return candidateLoc.includes(jobLoc) || jobLoc.includes(candidateLoc);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const criteria: MatchingCriteria = await req.json();
    console.log('🔍 Searching for candidates with criteria:', criteria);

    // Fetch all available independent candidates
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('status', 'available');

    if (error) {
      console.error('❌ Error fetching candidates:', error);
      throw new Error(error.message);
    }

    console.log(`📊 Found ${candidates?.length || 0} available candidates`);

    if (!candidates || candidates.length === 0) {
      const emptyResult: MatchResult = {
        totalCandidates: 0,
        excellent: 0,
        good: 0,
        fair: 0,
        minimal: 0,
        breakdown: {
          salaryMatches: 0,
          locationMatches: 0,
          skillsAnalysis: {
            averageMatch: 0,
            topSkills: []
          }
        }
      };
      
      return new Response(JSON.stringify(emptyResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let salaryMatches = 0;
    let locationMatches = 0;
    let skillMatches: number[] = [];
    let qualifiedCandidates = 0;
    let excellent = 0, good = 0, fair = 0, minimal = 0;

    // Analyze each candidate
    for (const candidate of candidates) {
      // Primary filters: salary and location
      const salaryMatch = checkSalaryCompatibility(
        criteria.salary_min,
        criteria.salary_max,
        candidate.salary_amount,
        criteria.currency,
        candidate.salary_currency,
        criteria.salary_period,
        candidate.salary_period
      );
      
      const locationMatch = checkLocationCompatibility(
        criteria.location,
        [candidate.location_city, candidate.location_state, candidate.location_country]
          .filter(Boolean)
          .join(', ')
      );

      if (salaryMatch) salaryMatches++;
      if (locationMatch) locationMatches++;

      // Only proceed with skill matching if salary and location are compatible
      if (salaryMatch && locationMatch) {
        console.log(`\n🧑‍💼 Analyzing candidate: ${candidate.candidate_name}`);
        console.log(`💰 Salary: ${candidate.salary_amount} ${candidate.salary_currency}`);
        console.log(`📍 Location: ${[candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean).join(', ')}`);
        
        const skillMatchPercentage = calculateSkillMatch(
          criteria.skills || [],
          candidate.skills || []
        );
        
        skillMatches.push(skillMatchPercentage);
        
        // Categorize by skill match percentage (minimum 20% to be included)
        if (skillMatchPercentage >= 20 || !criteria.skills || criteria.skills.length === 0) {
          qualifiedCandidates++;
          
          if (skillMatchPercentage >= 90) excellent++;
          else if (skillMatchPercentage >= 70) good++;
          else if (skillMatchPercentage >= 50) fair++;
          else minimal++;
        }
      }
    }

    // Calculate top skills from qualified candidates
    const allCandidateSkills = candidates
      .filter(c => c.skills && c.skills.length > 0)
      .flatMap(c => c.skills || []);
    
    const skillCounts = allCandidateSkills.reduce((acc: Record<string, number>, skill: string) => {
      const normalizedSkill = skill.toLowerCase().trim();
      acc[normalizedSkill] = (acc[normalizedSkill] || 0) + 1;
      return acc;
    }, {});

    const topSkills = Object.entries(skillCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([skill]) => skill);

    const result: MatchResult = {
      totalCandidates: qualifiedCandidates,
      excellent,
      good,
      fair,
      minimal,
      breakdown: {
        salaryMatches,
        locationMatches,
        skillsAnalysis: {
          averageMatch: skillMatches.length > 0 
            ? skillMatches.reduce((a, b) => a + b, 0) / skillMatches.length 
            : 0,
          topSkills
        }
      }
    };

    console.log('✅ Candidate matching result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in count-matching-candidates function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      totalCandidates: 0,
      excellent: 0,
      good: 0,
      fair: 0,
      minimal: 0,
      breakdown: {
        salaryMatches: 0,
        locationMatches: 0,
        skillsAnalysis: { averageMatch: 0, topSkills: [] }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});