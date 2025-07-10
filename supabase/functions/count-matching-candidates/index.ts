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

// CoreSignal integration functions
function buildCoreSignalQuery(criteria: MatchingCriteria): any {
  const query: any = {
    query: {
      bool: {
        must: [],
        should: [],
        filter: []
      }
    },
    size: 1000, // Maximum we can get in one search
    _source: [
      "id", "name", "location", "country", "experience", "summary",
      "title", "member_skills_collection", "member_education_collection", "last_updated_ux"
    ]
  };

  // Skills matching
  if (criteria.skills && criteria.skills.length > 0) {
    const skillsQuery = {
      bool: {
        should: criteria.skills.map(skill => ({
          multi_match: {
            query: skill,
            fields: [
              "experience.title^2",
              "experience.company_name",
              "member_skills_collection.member_skill_list.skill^3",
              "summary",
              "title^2"
            ],
            type: "best_fields",
            fuzziness: "AUTO"
          }
        })),
        minimum_should_match: Math.ceil(criteria.skills.length * 0.3) // At least 30% of skills should match
      }
    };
    query.query.bool.must.push(skillsQuery);
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
    
    // Direct location search
    const locationTerms = criteria.location.split(/[,\s]+/).filter(term => term.length > 2);
    if (locationTerms.length > 0) {
      locationQuery.bool.should.push(...locationTerms.map(term => ({
        multi_match: {
          query: term,
          fields: ["country^2", "location"],
          fuzziness: "AUTO"
        }
      })));
    }
    
    // Regional search - if we detect a region, include all countries in that region
    if (targetRegion && REGIONAL_MAPPINGS[targetRegion]) {
      console.log(`🌍 Expanding search to include all ${targetRegion} countries`);
      locationQuery.bool.should.push(...REGIONAL_MAPPINGS[targetRegion].map(country => ({
        match: {
          "country": {
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
              "country": {
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
      last_updated_ux: {
        gte: 1577836800 // Unix timestamp for 2020-01-01
      }
    }
  });

  return query;
}

async function searchCoreSignal(criteria: MatchingCriteria): Promise<{ candidates: CoreSignalCandidate[], creditsUsed: number }> {
  console.log('🌐 Starting CoreSignal search...');
  
  if (!CORESIGNAL_API_KEY) {
    console.error('🚫 CORESIGNAL_API_KEY not found in environment variables');
    return { candidates: [], creditsUsed: 0 };
  }

  // Validate API key format
  if (!CORESIGNAL_API_KEY.startsWith('cs_')) {
    console.error('🚫 Invalid CoreSignal API key format (should start with cs_)');
    return { candidates: [], creditsUsed: 0 };
  }

  console.log('✅ CoreSignal API key found and validated');

  try {
    const esQuery = buildCoreSignalQuery(criteria);
    console.log('🔍 CoreSignal query built:');
    console.log('   - Skills:', criteria.skills?.length || 0, 'skills');
    console.log('   - Location:', criteria.location);
    console.log('   - Salary range:', criteria.salaryMin, '-', criteria.salaryMax, criteria.currency);
    console.log('   - Full query:', JSON.stringify(esQuery, null, 2));

    const startTime = Date.now();
    console.log('📡 Sending request to CoreSignal API...');

    const response = await fetch(`${CORESIGNAL_BASE_URL}/v2/employee_clean/search/es_dsl`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CORESIGNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(esQuery)
    });

    const requestTime = Date.now() - startTime;
    console.log(`⏱️ CoreSignal API response time: ${requestTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ CoreSignal API error:');
      console.error('   - Status:', response.status);
      console.error('   - Status Text:', response.statusText);
      console.error('   - Error Response:', errorText);
      console.error('   - Request URL:', `${CORESIGNAL_BASE_URL}/v2/employee_clean/search/es_dsl`);
      console.error('   - Headers sent:', {
        'Authorization': `Bearer ${CORESIGNAL_API_KEY.substring(0, 10)}...`,
        'Content-Type': 'application/json'
      });
      return { candidates: [], creditsUsed: 0 };
    }

    const data = await response.json();
    const candidateCount = data.hits?.hits?.length || 0;
    const totalHits = data.hits?.total?.value || data.hits?.total || 0;
    
    console.log(`✅ CoreSignal API Success:`);
    console.log(`   - Candidates returned: ${candidateCount}`);
    console.log(`   - Total matches in DB: ${totalHits}`);
    console.log(`   - Response structure:`, {
      hasHits: !!data.hits,
      hitsCount: candidateCount,
      totalValue: totalHits,
      took: data.took
    });

    // Transform CoreSignal data to our format
    const candidates: CoreSignalCandidate[] = (data.hits?.hits || []).map((hit: any) => {
      const source = hit._source;
      
      // Extract skills from member_skills_collection
      const skills = source.member_skills_collection?.map((skillItem: any) => 
        skillItem.member_skill_list?.skill
      ).filter(Boolean) || [];
      
      return {
        id: source.id || hit._id,
        name: source.name || 'Unknown',
        location: {
          country: source.country,
          region: source.location, // CoreSignal's "location" field often contains region/city info
          city: source.location
        },
        experience: source.experience || [],
        skills: skills,
        summary: source.summary || '',
        salary: extractSalaryFromExperience(source.experience)
      };
    });

    console.log(`🔄 Processing ${candidateCount} CoreSignal candidates...`);
    
    // Log a sample candidate for debugging
    if (candidateCount > 0) {
      const sampleCandidate = data.hits.hits[0]._source;
      console.log('📋 Sample candidate structure:', {
        id: sampleCandidate.id,
        name: sampleCandidate.name ? 'Present' : 'Missing',
        location: sampleCandidate.location,
        country: sampleCandidate.country,
        title: sampleCandidate.title,
        skillsCount: sampleCandidate.member_skills_collection?.length || 0,
        experienceCount: sampleCandidate.experience?.length || 0,
        hasSkillsCollection: !!sampleCandidate.member_skills_collection
      });
    }

    return { 
      candidates, 
      creditsUsed: candidateCount > 0 ? 1 : 0 // Only count as credit used if we got results
    };
  } catch (error) {
    console.error('❌ CoreSignal search error:');
    console.error('   - Error type:', error.name);
    console.error('   - Error message:', error.message);
    console.error('   - Stack trace:', error.stack);
    
    // Check if it's a network error
    if (error.message.includes('fetch')) {
      console.error('🌐 Network error - check internet connection and API endpoint');
    }
    
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
    location_state: location?.region,
    location_city: location?.city,
    skills: coreSignalCandidate.skills || [],
    profile_summary: coreSignalCandidate.summary,
    salary_amount: coreSignalCandidate.salary?.amount,
    salary_currency: coreSignalCandidate.salary?.currency || 'USD',
    salary_period: coreSignalCandidate.salary?.period || 'annual',
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