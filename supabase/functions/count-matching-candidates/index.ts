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
}

interface MatchResult {
  totalCandidates: number;
  excellent: number; // 90-100% skill match
  good: number;      // 70-89% skill match
  fair: number;      // 50-69% skill match
  minimal: number;   // 30-49% skill match
  breakdown: {
    salaryMatches: number;
    locationMatches: number;
    skillsAnalysis: {
      averageMatch: number;
      topSkills: string[];
    };
  };
}

function calculateSkillMatch(jobSkills: string[], candidateSkills: string[]): number {
  if (!jobSkills || !candidateSkills || jobSkills.length === 0 || candidateSkills.length === 0) {
    return 0;
  }
  
  const jobSkillsLower = jobSkills.map(skill => skill.toLowerCase().trim());
  const candidateSkillsLower = candidateSkills.map(skill => skill.toLowerCase().trim());
  
  const matches = jobSkillsLower.filter(skill => 
    candidateSkillsLower.some(cSkill => 
      cSkill.includes(skill) || skill.includes(cSkill)
    )
  );
  
  return (matches.length / jobSkillsLower.length) * 100;
}

function checkSalaryCompatibility(
  jobMin?: number, 
  jobMax?: number, 
  candidateSalary?: number,
  jobCurrency?: string,
  candidateCurrency?: string
): boolean {
  if (!candidateSalary) return true; // No salary requirement from candidate
  if (!jobMin && !jobMax) return true; // No salary range specified in job
  
  // Simple currency check - in real world, we'd convert currencies
  if (jobCurrency && candidateCurrency && jobCurrency !== candidateCurrency) {
    return true; // For now, assume convertible
  }
  
  const effectiveJobMin = jobMin || 0;
  const effectiveJobMax = jobMax || Number.MAX_SAFE_INTEGER;
  
  // Allow 20% flexibility in salary expectations
  const flexibilityFactor = 1.2;
  const adjustedCandidateSalary = candidateSalary / flexibilityFactor;
  
  return adjustedCandidateSalary <= effectiveJobMax && candidateSalary >= effectiveJobMin * 0.8;
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
        candidate.salary_currency
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
        const skillMatchPercentage = calculateSkillMatch(
          criteria.skills || [],
          candidate.skills || []
        );
        
        skillMatches.push(skillMatchPercentage);
        
        // Categorize by skill match percentage (minimum 30% to be included)
        if (skillMatchPercentage >= 30 || !criteria.skills || criteria.skills.length === 0) {
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