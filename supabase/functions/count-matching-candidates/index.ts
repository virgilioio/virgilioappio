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
    coreSignalCandidates: number;
    localCandidates: number;
    creditsUsed: number;
    coreSignalError?: string;
    searchStrategy: string;
    skillsAnalysis: {
      averageMatch: number;
      topSkills: string[];
    };
  };
}

interface CoreSignalCandidate {
  id: string;
  name: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    state?: string;
  };
  experience?: Array<{
    title?: string;
    company?: string;
    duration?: string;
  }>;
  skills?: string[];
  summary?: string;
  salary?: {
    amount?: number;
    currency?: string;
    period?: string;
  };
  current_role?: string;
  current_company?: string;
  linkedin_url?: string;
  years_experience?: number;
  education?: Array<any>;
}

interface CoreSignalSearchResult {
  employees: CoreSignalCandidate[];
  count: number;
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
  'account management': ['account manager', 'key account', 'client management'],
  'human resources': ['hr', 'people operations', 'talent acquisition'],
  'cold calling': ['outbound calling', 'prospecting calls', 'sales calls'],
  'lead generation': ['lead gen', 'prospecting', 'lead qualification']
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

async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
  if (fromCurrency === toCurrency) return amount;
  
  try {
    // Use the platform's currency conversion function
    const { data: rate, error } = await supabase.rpc('get_organization_currency_rate', {
      from_currency: fromCurrency,
      to_currency: toCurrency
    });
    
    if (error) {
      console.warn(`Currency conversion error: ${error.message}, using fallback rate`);
      return amount; // Fallback to original amount
    }
    
    return amount * (rate || 1);
  } catch (error) {
    console.warn('Currency conversion failed:', error);
    return amount; // Fallback to original amount
  }
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
  
  return [...new Set(extractedSkills)]; // Remove duplicates
}

function calculateSkillMatch(jobSkills: string[], candidateSkills: string[], candidateSummary?: string): number {
  // If no job skills specified, return high match
  if (!jobSkills || jobSkills.length === 0) {
    return 85;
  }
  
  let skillsToMatch = candidateSkills || [];
  
  // If candidate has no explicit skills, try to extract from profile summary
  if ((!candidateSkills || candidateSkills.length === 0) && candidateSummary) {
    skillsToMatch = extractSkillsFromSummary(candidateSummary);
    console.log(`🔍 Extracted skills from summary: [${skillsToMatch.join(', ')}]`);
  }
  
  // If still no skills found, give a base score instead of 0 (maybe the candidate just doesn't have skills listed)
  if (skillsToMatch.length === 0) {
    return candidateSummary ? 30 : 15; // Some score if has summary, minimal if not
  }
  
  const normalizedJobSkills = jobSkills.map(normalizeSkill);
  const normalizedCandidateSkills = skillsToMatch.map(normalizeSkill);
  
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

async function checkSalaryCompatibility(
  jobMin?: number, 
  jobMax?: number, 
  candidateSalary?: number,
  jobCurrency?: string,
  candidateCurrency?: string,
  jobSalaryPeriod?: string,
  candidateSalaryPeriod?: string
): Promise<boolean> {
  if (!candidateSalary) return true; // No salary requirement from candidate
  if (!jobMin && !jobMax) return true; // No salary range specified in job
  
  console.log(`💰 Salary comparison: Job: ${jobMin}-${jobMax} ${jobCurrency}/${jobSalaryPeriod}, Candidate: ${candidateSalary} ${candidateCurrency}/${candidateSalaryPeriod}`);
  
  // Normalize all salaries to annual in USD for comparison
  const normalizedJobMin = jobMin ? await convertCurrency(normalizeSalaryToAnnual(jobMin, jobSalaryPeriod || 'annual'), jobCurrency || 'USD', 'USD') : 0;
  const normalizedJobMax = jobMax ? await convertCurrency(normalizeSalaryToAnnual(jobMax, jobSalaryPeriod || 'annual'), jobCurrency || 'USD', 'USD') : Number.MAX_SAFE_INTEGER;
  const normalizedCandidateSalary = await convertCurrency(normalizeSalaryToAnnual(candidateSalary, candidateSalaryPeriod || 'annual'), candidateCurrency || 'USD', 'USD');
  
  console.log(`💰 Normalized comparison: Job: ${normalizedJobMin}-${normalizedJobMax} USD/annual, Candidate: ${normalizedCandidateSalary} USD/annual`);
  
  // Allow 20% flexibility in salary expectations
  const flexibilityFactor = 1.2;
  const adjustedCandidateSalary = normalizedCandidateSalary / flexibilityFactor;
  
  const isCompatible = adjustedCandidateSalary <= normalizedJobMax && normalizedCandidateSalary >= normalizedJobMin * 0.8;
  console.log(`💰 Salary compatibility: ${isCompatible ? '✅' : '❌'}`);
  
  return isCompatible;
}

// Regional mapping for enhanced location matching
const REGIONAL_MAPPINGS = {
  'LATAM': ['mexico', 'guatemala', 'belize', 'el salvador', 'honduras', 'nicaragua', 'costa rica', 'panama', 'colombia', 'venezuela', 'guyana', 'suriname', 'french guiana', 'brazil', 'ecuador', 'peru', 'bolivia', 'paraguay', 'chile', 'argentina', 'uruguay'],
  'EMEA': ['europe', 'middle east', 'africa', 'united kingdom', 'germany', 'france', 'spain', 'italy', 'netherlands', 'sweden', 'norway', 'denmark', 'poland', 'romania', 'czech republic', 'hungary', 'bulgaria', 'slovakia', 'slovenia', 'croatia', 'serbia', 'bosnia', 'montenegro', 'albania', 'macedonia', 'greece', 'cyprus', 'malta', 'estonia', 'latvia', 'lithuania', 'finland', 'belgium', 'luxembourg', 'austria', 'switzerland', 'portugal', 'ireland', 'ukraine', 'russia', 'turkey', 'israel', 'egypt', 'south africa', 'nigeria', 'kenya', 'ghana', 'morocco', 'tunisia', 'algeria', 'libya', 'sudan', 'ethiopia', 'uganda', 'tanzania', 'zimbabwe', 'zambia', 'botswana', 'namibia', 'angola', 'mozambique', 'madagascar', 'mauritius', 'seychelles', 'uae', 'saudi arabia', 'qatar', 'bahrain', 'kuwait', 'oman', 'jordan', 'lebanon', 'iraq', 'iran'],
  'APAC': ['asia', 'pacific', 'china', 'japan', 'south korea', 'north korea', 'taiwan', 'hong kong', 'macau', 'singapore', 'malaysia', 'thailand', 'vietnam', 'cambodia', 'laos', 'myanmar', 'indonesia', 'philippines', 'brunei', 'timor-leste', 'papua new guinea', 'australia', 'new zealand', 'fiji', 'samoa', 'tonga', 'vanuatu', 'solomon islands', 'palau', 'micronesia', 'marshall islands', 'nauru', 'kiribati', 'tuvalu', 'india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'bhutan', 'maldives', 'afghanistan', 'mongolia', 'kazakhstan', 'uzbekistan', 'turkmenistan', 'kyrgyzstan', 'tajikistan'],
  'NORTH_AMERICA': ['united states', 'usa', 'canada', 'us', 'america', 'american']
};

function normalizeLocationForMatching(location: string): string {
  return location.toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, ' ')
    .trim();
}

function getRegionFromLocation(location: string): string | null {
  const normalized = normalizeLocationForMatching(location);
  
  // Check for explicit regional keywords
  if (normalized.includes('latam') || normalized.includes('latin america')) return 'LATAM';
  if (normalized.includes('emea')) return 'EMEA';
  if (normalized.includes('apac') || normalized.includes('asia pacific')) return 'APAC';
  if (normalized.includes('north america')) return 'NORTH_AMERICA';
  
  // Check if location matches any country in regions
  for (const [region, countries] of Object.entries(REGIONAL_MAPPINGS)) {
    if (countries.some(country => normalized.includes(country))) {
      return region;
    }
  }
  
  return null;
}

function checkLocationCompatibility(jobLocation?: string, candidateLocation?: string): boolean {
  if (!jobLocation) return true; // No location requirement
  if (!candidateLocation) return true; // No location specified by candidate
  
  const jobLoc = normalizeLocationForMatching(jobLocation);
  const candidateLoc = normalizeLocationForMatching(candidateLocation);
  
  console.log(`🌍 Location matching: Job="${jobLoc}" vs Candidate="${candidateLoc}"`);
  
  // Check for remote keywords - always compatible
  if (jobLoc.includes('remote') || jobLoc.includes('anywhere') || candidateLoc.includes('remote')) {
    console.log('✅ Remote work detected - location compatible');
    return true;
  }
  
  // Direct location match (city, state, country)
  if (candidateLoc.includes(jobLoc) || jobLoc.includes(candidateLoc)) {
    console.log('✅ Direct location match');
    return true;
  }
  
  // Regional matching - enhanced intelligence
  const jobRegion = getRegionFromLocation(jobLocation);
  const candidateRegion = getRegionFromLocation(candidateLocation);
  
  if (jobRegion && candidateRegion) {
    const isRegionalMatch = jobRegion === candidateRegion;
    console.log(`🌍 Regional analysis: Job region="${jobRegion}", Candidate region="${candidateRegion}", Match=${isRegionalMatch}`);
    
    if (isRegionalMatch) {
      console.log('✅ Regional match found');
      return true;
    }
  }
  
  // Handle "Remote - [Region]" format
  if (jobLoc.includes('remote') && jobLoc.includes('-')) {
    const remoteRegionMatch = jobLoc.match(/remote\s*-\s*(\w+)/);
    if (remoteRegionMatch) {
      const targetRegion = remoteRegionMatch[1].toUpperCase();
      if (candidateRegion === targetRegion || (targetRegion === 'LATAM' && candidateRegion === 'LATAM')) {
        console.log(`✅ Remote region match: ${targetRegion}`);
        return true;
      }
    }
  }
  
  console.log('❌ No location compatibility found');
  return false;
}

// Helper functions for CoreSignal data transformation
function extractCityFromRawAddress(rawAddress?: string): string | undefined {
  if (!rawAddress) return undefined;
  
  // Common formats: "City, State, Country" or "City, Country"
  const parts = rawAddress.split(',').map(part => part.trim());
  if (parts.length > 0) {
    return parts[0]; // First part is usually the city
  }
  
  return undefined;
}

function extractStateFromRawAddress(rawAddress?: string): string | undefined {
  if (!rawAddress) return undefined;
  
  // Common formats: "City, State, Country"
  const parts = rawAddress.split(',').map(part => part.trim());
  if (parts.length >= 3) {
    return parts[1]; // Second part is usually the state/region
  }
  
  return undefined;
}

function getCurrentRoleFromExperience(experience?: any[]): string | undefined {
  if (!experience || experience.length === 0) return undefined;
  
  // Find the most recent/current position
  const currentRole = experience.find(exp => exp.is_current) || experience[0];
  return currentRole?.title;
}

function getCurrentCompanyFromExperience(experience?: any[]): string | undefined {
  if (!experience || experience.length === 0) return undefined;
  
  // Find the most recent/current position
  const currentRole = experience.find(exp => exp.is_current) || experience[0];
  return currentRole?.company_name;
}

// CoreSignal integration functions
function buildCoreSignalQuery(criteria: MatchingCriteria): any {
  console.log('🔧 Building CoreSignal query with criteria:', JSON.stringify(criteria, null, 2));
  
  const query: any = {
    query: {
      bool: {
        must: [],
        should: [],
        filter: []
      }
    },
    size: 100 // Reduce size for debugging
  };

  // Skills matching - simplified approach for debugging
  if (criteria.skills && criteria.skills.length > 0) {
    console.log('🏷️ Adding skills query for:', criteria.skills);
    
    // Try a much simpler approach first
    const skillsQuery = {
      bool: {
        should: criteria.skills.map(skill => [
          // Simple term match
          { term: { "skills": skill.toLowerCase() } },
          // Simple match in description
          { match: { "description": skill } },
          // Simple match in job title
          { match: { "job_title": skill } },
          // Simple match in headline
          { match: { "headline": skill } }
        ]).flat(),
        minimum_should_match: 1 // Just need one match
      }
    };
    query.query.bool.must.push(skillsQuery);
    console.log('🏷️ Skills query added:', JSON.stringify(skillsQuery, null, 2));
  }

  // Enhanced location matching with regional intelligence
  if (criteria.location && !criteria.location.toLowerCase().includes('remote')) {
    const normalizedLocation = normalizeLocationForMatching(criteria.location);
    const targetRegion = getRegionFromLocation(criteria.location);
    
    const locationQuery: any = {
      bool: {
        should: []
      }
    };
    
    // Direct location search using correct fields
    const locationTerms = criteria.location.split(/[,\s]+/).filter(term => term.length > 2);
    if (locationTerms.length > 0) {
      locationQuery.bool.should.push(...locationTerms.map(term => ({
        multi_match: {
          query: term,
          fields: ["location_country^2", "location_raw_address", "location_regions"],
          fuzziness: "AUTO"
        }
      })));
    }
    
    // Regional search - if we detect a region, include all countries in that region
    if (targetRegion && REGIONAL_MAPPINGS[targetRegion]) {
      console.log(`🌍 Expanding search to include all ${targetRegion} countries`);
      locationQuery.bool.should.push(...REGIONAL_MAPPINGS[targetRegion].map(country => ({
        match: {
          "location_country": {
            query: country,
            fuzziness: "AUTO"
          }
        }
      })));
    }
    
    // Handle "Remote - [Region]" format
    if (normalizedLocation.includes('remote') && normalizedLocation.includes('-')) {
      const remoteRegionMatch = normalizedLocation.match(/remote\s*-\s*(\w+)/);
      if (remoteRegionMatch) {
        const remoteTargetRegion = remoteRegionMatch[1].toUpperCase();
        if (REGIONAL_MAPPINGS[remoteTargetRegion]) {
          console.log(`🌍 Remote ${remoteTargetRegion} search - including all countries in region`);
          locationQuery.bool.should.push(...REGIONAL_MAPPINGS[remoteTargetRegion].map(country => ({
            match: {
              "location_country": {
                query: country,
                fuzziness: "AUTO"
              }
            }
          })));
        }
      }
    }
    
    if (locationQuery.bool.should.length > 0) {
      query.query.bool.must.push(locationQuery);
    }
  }

  // Add activity filter to get more recent profiles
  query.query.bool.filter.push({
    range: {
      last_updated: {
        gte: "2020-01-01" // Date format for more recent profiles
      }
    }
  });

  return query;
}

async function searchCoreSignal(criteria: MatchingCriteria): Promise<{ candidates: CoreSignalCandidate[], creditsUsed: number }> {
  console.log('🌐 Starting CoreSignal two-step search...');
  console.log('📊 API Key status:', CORESIGNAL_API_KEY ? `Available (${CORESIGNAL_API_KEY.substring(0, 8)}...)` : 'Not found');
  console.log('🌐 Base URL:', CORESIGNAL_BASE_URL);
  
  if (!CORESIGNAL_API_KEY) {
    console.error('🚫 CORESIGNAL_API_KEY not found in environment variables');
    return { candidates: [], creditsUsed: 0 };
  }

  console.log('✅ CoreSignal API key found and validated');

  try {
    // Step 1: Search for candidate IDs
    const esQuery = buildCoreSignalQuery(criteria);
    console.log('🔍 Step 1: Searching for candidate IDs...');
    console.log('   - Skills:', criteria.skills?.length || 0, 'skills');
    console.log('   - Location:', criteria.location);
    console.log('   - Salary range:', criteria.salary_min, '-', criteria.salary_max, criteria.currency);

    const searchStartTime = Date.now();
    const searchResponse = await fetch(`${CORESIGNAL_BASE_URL}/cdapi/v2/employee_clean/search/es_dsl`, {
      method: 'POST',
      headers: {
        'apikey': CORESIGNAL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(esQuery)
    });

    const searchTime = Date.now() - searchStartTime;
    console.log(`⏱️ Search API response time: ${searchTime}ms`);

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('❌ CoreSignal Search API error:');
      console.error('   - Status:', searchResponse.status);
      console.error('   - Status Text:', searchResponse.statusText);
      console.error('   - Error Response:', errorText);
      return { candidates: [], creditsUsed: 0 };
    }

    const searchData = await searchResponse.json();
    const candidateIds = (searchData.hits?.hits || []).map((hit: any) => hit._id);
    const totalHits = searchData.hits?.total?.value || searchData.hits?.total || 0;
    
    console.log(`✅ Search completed:`);
    console.log(`   - Candidate IDs found: ${candidateIds.length}`);
    console.log(`   - Total matches in DB: ${totalHits}`);
    console.log(`   - Sample IDs:`, candidateIds.slice(0, 3));

    if (candidateIds.length === 0) {
      console.log('📭 No candidate IDs found in search results. Trying fallback search...');
      
      // Try a much broader fallback search
      const fallbackQuery = {
        query: { match_all: {} },
        size: 50
      };
      
      console.log('🔄 Attempting fallback search with match_all query');
      
      const fallbackResponse = await fetch(`${CORESIGNAL_BASE_URL}/cdapi/v2/employee_clean/search/es_dsl`, {
        method: 'POST',
        headers: {
          'apikey': CORESIGNAL_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackQuery)
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        const fallbackIds = (fallbackData.hits?.hits || []).map((hit: any) => hit._id);
        console.log(`🔄 Fallback search found ${fallbackIds.length} candidates`);
        
        if (fallbackIds.length > 0) {
          // Use fallback results but limit to 10 for testing
          const limitedIds = fallbackIds.slice(0, 10);
          console.log(`📝 Using first ${limitedIds.length} candidates from fallback search`);
          
          // Continue with collection process using limited fallback results
          const candidateIds = limitedIds;
          
          // Step 2: Collect full profile data for each ID
          console.log(`🔍 Step 2: Collecting full profiles for ${candidateIds.length} candidates...`);
          const candidates: CoreSignalCandidate[] = [];
          const collectErrors: string[] = [];
          let successfulCollects = 0;
          
          for (let i = 0; i < candidateIds.length; i++) {
            const candidateId = candidateIds[i];
            
            try {
              console.log(`📋 Collecting candidate ${i + 1}/${candidateIds.length}: ID ${candidateId}`);
              
              const collectResponse = await fetch(`${CORESIGNAL_BASE_URL}/cdapi/v2/employee_clean/collect/${candidateId}`, {
                method: 'GET',
                headers: {
                  'apikey': CORESIGNAL_API_KEY,
                  'Content-Type': 'application/json',
                }
              });
      
              if (!collectResponse.ok) {
                const errorText = await collectResponse.text();
                console.warn(`⚠️ Failed to collect candidate ${candidateId}: ${collectResponse.status} - ${errorText}`);
                collectErrors.push(`${candidateId}: ${collectResponse.status}`);
                continue;
              }
      
              const candidateData = await collectResponse.json();
              console.log(`✅ Successfully collected candidate ${candidateId} via fallback`);
              
              // Transform to our format
              const candidate: CoreSignalCandidate = {
                id: candidateData.id || candidateId,
                name: candidateData.full_name || candidateData.name || 'Unknown',
                location: {
                  country: candidateData.location_country,
                  region: candidateData.location_regions?.[0] || candidateData.location_regions,
                  city: extractCityFromRawAddress(candidateData.location_raw_address),
                  state: extractStateFromRawAddress(candidateData.location_raw_address)
                },
                experience: candidateData.experience || [],
                skills: Array.isArray(candidateData.skills) ? candidateData.skills : [],
                summary: candidateData.description || candidateData.headline || candidateData.summary || '',
                salary: extractSalaryFromExperience(candidateData.experience),
                current_role: candidateData.job_title || getCurrentRoleFromExperience(candidateData.experience),
                current_company: getCurrentCompanyFromExperience(candidateData.experience),
                linkedin_url: candidateData.websites_linkedin,
                years_experience: Math.floor((candidateData.total_experience_duration_months || 0) / 12),
                education: candidateData.education || []
              };
      
              candidates.push(candidate);
              successfulCollects++;
      
              // Add small delay to avoid rate limiting
              if (i < candidateIds.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
      
            } catch (error) {
              console.warn(`⚠️ Error collecting candidate ${candidateId}:`, error.message);
              collectErrors.push(`${candidateId}: ${error.message}`);
            }
          }
          
          console.log(`🔄 Fallback collection summary:`);
          console.log(`   - Successful collects: ${successfulCollects}`);
          console.log(`   - Failed collects: ${collectErrors.length}`);
          console.log(`   - Total credits used: ${2 + successfulCollects} (2 searches + ${successfulCollects} collects)`);
          
          return { 
            candidates, 
            creditsUsed: 2 + successfulCollects // 2 for searches + collects
          };
        }
      }
      
      console.log('📭 Fallback search also returned no results');
      return { candidates: [], creditsUsed: 2 }; // Both searches used credits
    }

    // Step 2: Collect full profile data for each ID
    console.log(`🔍 Step 2: Collecting full profiles for ${candidateIds.length} candidates...`);
    const candidates: CoreSignalCandidate[] = [];
    const collectErrors: string[] = [];
    let successfulCollects = 0;

    // Limit to max 50 candidates to avoid excessive API calls
    const maxCandidates = Math.min(candidateIds.length, 50);
    const idsToCollect = candidateIds.slice(0, maxCandidates);
    
    console.log(`📝 Collecting data for ${idsToCollect.length} candidates (limited from ${candidateIds.length})`);

    for (let i = 0; i < idsToCollect.length; i++) {
      const candidateId = idsToCollect[i];
      
      try {
        console.log(`📋 Collecting candidate ${i + 1}/${idsToCollect.length}: ID ${candidateId}`);
        
        const collectResponse = await fetch(`${CORESIGNAL_BASE_URL}/cdapi/v2/employee_clean/collect/${candidateId}`, {
          method: 'GET',
          headers: {
            'apikey': CORESIGNAL_API_KEY,
            'Content-Type': 'application/json',
          }
        });

        if (!collectResponse.ok) {
          const errorText = await collectResponse.text();
          console.warn(`⚠️ Failed to collect candidate ${candidateId}: ${collectResponse.status} - ${errorText}`);
          collectErrors.push(`${candidateId}: ${collectResponse.status}`);
          continue;
        }

        const candidateData = await collectResponse.json();
        console.log(`✅ Successfully collected candidate ${candidateId}`);
        
        // Transform to our format
        const candidate: CoreSignalCandidate = {
          id: candidateData.id || candidateId,
          name: candidateData.full_name || candidateData.name || 'Unknown',
          location: {
            country: candidateData.location_country,
            region: candidateData.location_regions?.[0] || candidateData.location_regions,
            city: extractCityFromRawAddress(candidateData.location_raw_address),
            state: extractStateFromRawAddress(candidateData.location_raw_address)
          },
          experience: candidateData.experience || [],
          skills: Array.isArray(candidateData.skills) ? candidateData.skills : [],
          summary: candidateData.description || candidateData.headline || candidateData.summary || '',
          salary: extractSalaryFromExperience(candidateData.experience),
          current_role: candidateData.job_title || getCurrentRoleFromExperience(candidateData.experience),
          current_company: getCurrentCompanyFromExperience(candidateData.experience),
          linkedin_url: candidateData.websites_linkedin,
          years_experience: Math.floor((candidateData.total_experience_duration_months || 0) / 12),
          education: candidateData.education || []
        };

        candidates.push(candidate);
        successfulCollects++;

        // Add small delay to avoid rate limiting
        if (i < idsToCollect.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.warn(`⚠️ Error collecting candidate ${candidateId}:`, error.message);
        collectErrors.push(`${candidateId}: ${error.message}`);
      }
    }

    console.log(`🔄 Collection summary:`);
    console.log(`   - Successful collects: ${successfulCollects}`);
    console.log(`   - Failed collects: ${collectErrors.length}`);
    console.log(`   - Total credits used: ${1 + successfulCollects} (1 search + ${successfulCollects} collects)`);
    
    if (collectErrors.length > 0) {
      console.log(`   - Collect errors:`, collectErrors.slice(0, 5));
    }

    // Log sample collected candidate
    if (candidates.length > 0) {
      const sampleCandidate = candidates[0];
      console.log('📋 Sample collected candidate:', {
        id: sampleCandidate.id,
        name: sampleCandidate.name,
        location: sampleCandidate.location,
        skillsCount: sampleCandidate.skills?.length || 0,
        hasExperience: (sampleCandidate.experience?.length || 0) > 0,
        hasSummary: !!sampleCandidate.summary
      });
    }

    return { 
      candidates, 
      creditsUsed: 1 + successfulCollects // 1 for search + 1 for each successful collect
    };

  } catch (error) {
    console.error('❌ CoreSignal two-step search error:');
    console.error('   - Error type:', error.name);
    console.error('   - Error message:', error.message);
    console.error('   - Stack trace:', error.stack);
    
    return { candidates: [], creditsUsed: 0 };
  }
}

function extractSalaryFromExperience(experience: any[]): { amount?: number; currency?: string; period?: string } | undefined {
  // CoreSignal doesn't typically include salary data in search results
  // This is a placeholder for potential future salary data
  return undefined;
}

function convertCoreSignalToLocalFormat(coreSignalCandidate: CoreSignalCandidate): any {
  const location = coreSignalCandidate.location;
  return {
    id: `coresignal_${coreSignalCandidate.id}`,
    candidate_name: coreSignalCandidate.name,
    location_country: location?.country,
    location_state: location?.state,
    location_city: location?.city,
    skills: coreSignalCandidate.skills || [],
    profile_summary: coreSignalCandidate.summary,
    salary_amount: coreSignalCandidate.salary?.amount,
    salary_currency: coreSignalCandidate.salary?.currency || 'USD',
    salary_period: coreSignalCandidate.salary?.period || 'annual',
    linkedin_url: coreSignalCandidate.linkedin_url,
    role_current: coreSignalCandidate.current_role,
    company_current: coreSignalCandidate.current_company,
    years_experience: coreSignalCandidate.years_experience,
    source: 'coresignal'
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const criteria: MatchingCriteria = await req.json();
    console.log('🔍 Searching for candidates with criteria:', criteria);

    // Step 1: Search local database first (include all candidates, not just available)
    const { data: localCandidates, error } = await supabase
      .from('candidates')
      .select('*')
      .in('status', ['available', 'available_passive', 'considering']); // Include more candidate statuses

    if (error) {
      console.error('❌ Error fetching local candidates:', error);
      throw new Error(error.message);
    }

    console.log(`📊 Found ${localCandidates?.length || 0} local candidates`);

    // Step 2: Determine if we need CoreSignal search
    const localCount = localCandidates?.length || 0;
    const hasApiKey = !!CORESIGNAL_API_KEY;
    const shouldSearchCoreSignal = hasApiKey; // Always search CoreSignal when API key is available
    
    console.log('🔍 CoreSignal search decision:');
    console.log(`   - Local candidates: ${localCount}`);
    console.log(`   - API key available: ${hasApiKey}`);
    console.log(`   - Will search CoreSignal: ${shouldSearchCoreSignal}`);
    
    let coreSignalCandidates: CoreSignalCandidate[] = [];
    let creditsUsed = 0;
    let coreSignalError = null;

    if (shouldSearchCoreSignal) {
      console.log('🌐 Initiating CoreSignal search for additional candidates...');
      const coreSignalResult = await searchCoreSignal(criteria);
      coreSignalCandidates = coreSignalResult.candidates;
      creditsUsed = coreSignalResult.creditsUsed;
      console.log(`🌐 CoreSignal search completed: ${coreSignalCandidates.length} candidates found (${creditsUsed} credits used)`);
      
      if (coreSignalCandidates.length === 0 && creditsUsed === 0) {
        coreSignalError = 'CoreSignal search failed or returned no results';
        console.warn('⚠️ CoreSignal search did not return any candidates');
      }
    } else if (!hasApiKey) {
      console.log('🚫 Skipping CoreSignal search: API key not configured');
      coreSignalError = 'CoreSignal API key not configured';
    }

    // Step 3: Combine and format all candidates
    const allCandidates = [
      ...(localCandidates || []),
      ...coreSignalCandidates.map(convertCoreSignalToLocalFormat)
    ];

    console.log(`📊 Total candidates to analyze: ${allCandidates.length} (${localCandidates?.length || 0} local + ${coreSignalCandidates.length} external)`);

    if (!allCandidates || allCandidates.length === 0) {
      const emptyResult: MatchResult = {
        totalCandidates: 0,
        excellent: 0,
        good: 0,
        fair: 0,
        minimal: 0,
          breakdown: {
            salaryMatches: 0,
            locationMatches: 0,
            coreSignalCandidates: 0,
            localCandidates: 0,
            creditsUsed: 0,
            coreSignalError: coreSignalError,
            searchStrategy: 'No candidates found',
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

    // Analyze each candidate - CHANGED: Include ALL candidates, not just perfect salary+location matches
    for (const candidate of allCandidates) {
      console.log(`\n🧑‍💼 Analyzing candidate: ${candidate.candidate_name}`);
      console.log(`💰 Salary: ${candidate.salary_amount || 'Not specified'} ${candidate.salary_currency || ''}`);
      console.log(`📍 Location: ${[candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean).join(', ') || 'Not specified'}`);
      
      // Check filters but don't use them to exclude entirely
      const salaryMatch = await checkSalaryCompatibility(
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

      // FIXED: Always check skill match, don't exclude based on salary/location
      const skillMatchPercentage = calculateSkillMatch(
        criteria.skills || [],
        candidate.skills || [],
        candidate.profile_summary
      );
      
      skillMatches.push(skillMatchPercentage);
      
      // Give bonus for salary and location matches
      let adjustedSkillMatch = skillMatchPercentage;
      if (salaryMatch) adjustedSkillMatch += 5; // 5% bonus for salary match
      if (locationMatch) adjustedSkillMatch += 5; // 5% bonus for location match
      adjustedSkillMatch = Math.min(100, adjustedSkillMatch); // Cap at 100%
      
      console.log(`🎯 Skill match: ${skillMatchPercentage}% (adjusted: ${adjustedSkillMatch}%)`);
      
      // Lower threshold - include more candidates (minimum 10% instead of 20%)
      if (adjustedSkillMatch >= 10 || !criteria.skills || criteria.skills.length === 0) {
        qualifiedCandidates++;
        
        if (adjustedSkillMatch >= 90) excellent++;
        else if (adjustedSkillMatch >= 70) good++;
        else if (adjustedSkillMatch >= 50) fair++;
        else minimal++;
        
        console.log(`✅ Candidate qualified (${adjustedSkillMatch >= 90 ? 'excellent' : adjustedSkillMatch >= 70 ? 'good' : adjustedSkillMatch >= 50 ? 'fair' : 'minimal'})`);
      } else {
        console.log(`❌ Candidate not qualified (${adjustedSkillMatch}% < 10%)`);
      }
    }

    // Calculate top skills from qualified candidates
    const allCandidateSkills = allCandidates
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
        coreSignalCandidates: coreSignalCandidates.length,
        localCandidates: localCandidates?.length || 0,
        creditsUsed,
        coreSignalError,
        searchStrategy: shouldSearchCoreSignal ? 'Local + CoreSignal' : (hasApiKey ? 'Local only (sufficient)' : 'Local only (no API key)'),
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
        coreSignalCandidates: 0,
        localCandidates: 0,
        creditsUsed: 0,
        skillsAnalysis: { averageMatch: 0, topSkills: [] }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});