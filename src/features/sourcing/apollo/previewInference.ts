/**
 * Inference helpers for Apollo preview data
 * Generate meaningful signals from minimal preview data (title + company [+ headline])
 * 
 * Redesigned for sparse data reality:
 * - Neutral defaults when data is missing
 * - Confidence-aware recommendations
 * - No penalties for missing information
 */

export type InferredSeniority = 'Junior' | 'Mid-level' | 'Senior' | 'Lead' | 'Director+' | 'Unknown'
export type InferredFunction =
  | 'Sales'
  | 'Customer Success'
  | 'Marketing'
  | 'Product'
  | 'Engineering'
  | 'Data'
  | 'Operations'
  | 'Finance'
  | 'HR'
  | 'Legal'
  | 'Other'

export interface CareerSnapshotInference {
  seniority: InferredSeniority
  yearsRangeLabel: string
  functionLabel: InferredFunction
  industryLabel: string
  companyStageLabel: string
  idealRoleExamples: string[]
  caveats: string[]
}

export interface JobComparisonSummary {
  titleMatchLabel: 'Strong' | 'Medium' | 'Weak' | 'Unknown'
  locationMatchLabel: 'Strong' | 'Medium' | 'Weak' | 'Unknown'
  industryMatchLabel: 'Strong' | 'Medium' | 'Weak' | 'Unknown'
  seniorityMatchLabel: 'Strong' | 'Medium' | 'Weak' | 'Unknown'
  notes: string[]
}

// Seniority keyword patterns
const SENIORITY_PATTERNS: Record<InferredSeniority, string[]> = {
  'Director+': ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'cpo', 'chief', 'president', 'founder', 'co-founder', 'partner', 'vp', 'vice president', 'director', 'head of', 'head'],
  'Lead': ['lead', 'principal', 'staff', 'architect', 'team lead'],
  'Senior': ['senior', 'sr.', 'sr ', 'specialist', 'expert'],
  'Mid-level': ['manager', 'analyst', 'engineer', 'developer', 'designer', 'consultant', 'coordinator', 'executive'],
  'Junior': ['junior', 'jr.', 'jr ', 'associate', 'assistant', 'intern', 'trainee', 'entry', 'graduate'],
  'Unknown': []
}

// Function keyword patterns
const FUNCTION_PATTERNS: Record<Exclude<InferredFunction, 'Other'>, string[]> = {
  'Sales': ['sales', 'account executive', 'ae', 'sdr', 'bdr', 'business development', 'revenue', 'quota', 'enterprise sales', 'mid-market', 'inside sales'],
  'Customer Success': ['customer success', 'cs', 'account manager', 'client success', 'customer experience', 'onboarding', 'retention'],
  'Marketing': ['marketing', 'growth', 'demand gen', 'brand', 'content', 'seo', 'sem', 'ppc', 'social media', 'communications'],
  'Product': ['product manager', 'product owner', 'product lead', 'pm', 'product design'],
  'Engineering': ['engineer', 'developer', 'programmer', 'frontend', 'backend', 'fullstack', 'devops', 'sre', 'software', 'mobile', 'ios', 'android', 'web'],
  'Data': ['data', 'analytics', 'machine learning', 'ml', 'ai', 'data scientist', 'data engineer', 'bi', 'intelligence'],
  'Operations': ['operations', 'ops', 'logistics', 'supply chain', 'procurement', 'project manager'],
  'Finance': ['finance', 'accounting', 'controller', 'fp&a', 'treasury', 'audit', 'tax'],
  'HR': ['hr', 'human resources', 'people', 'talent', 'recruiting', 'recruiter', 'hrbp', 'learning', 'culture'],
  'Legal': ['legal', 'counsel', 'attorney', 'lawyer', 'compliance', 'regulatory']
}

// Industry patterns from company names
const INDUSTRY_PATTERNS: Record<string, string[]> = {
  'SaaS / Software': ['software', 'saas', 'cloud', 'platform', 'tech', 'digital', 'app', 'systems', 'solutions', 'data'],
  'AdTech / MarTech': ['ad', 'ads', 'media', 'advertising', 'marketing tech', 'martech', 'programmatic', 'dsp', 'ssp'],
  'Fintech': ['fin', 'pay', 'bank', 'credit', 'lending', 'insurance', 'wealth', 'invest', 'trading', 'crypto'],
  'E-commerce / Retail': ['commerce', 'retail', 'shop', 'store', 'market', 'buy', 'sell'],
  'Healthcare / Biotech': ['health', 'medical', 'bio', 'pharma', 'clinical', 'care', 'wellness', 'therapeutic'],
  'Consulting / Services': ['consulting', 'advisory', 'partners', 'associates', 'services', 'group', 'agency']
}

// Well-known company patterns for stage inference
const ENTERPRISE_COMPANIES = [
  'google', 'microsoft', 'amazon', 'meta', 'apple', 'salesforce', 'oracle', 'sap', 'ibm',
  'cisco', 'dell', 'hp', 'intel', 'adobe', 'vmware', 'workday', 'servicenow', 'hubspot'
]

const GROWTH_STAGE_INDICATORS = ['series', 'backed', 'funded', 'raised']

function normalize(str: string | undefined | null): string {
  return (str || '').toLowerCase().trim()
}

function detectSeniority(title: string | undefined | null): InferredSeniority {
  if (!title) return 'Unknown'
  const normalizedTitle = normalize(title)
  
  for (const [level, patterns] of Object.entries(SENIORITY_PATTERNS)) {
    if (level === 'Unknown') continue
    for (const pattern of patterns) {
      if (normalizedTitle.includes(pattern)) {
        return level as InferredSeniority
      }
    }
  }
  
  // Default to Mid-level if we have a title but can't determine seniority
  return 'Mid-level'
}

function detectFunction(title: string | undefined | null, headline: string | undefined | null): InferredFunction {
  const combined = normalize(`${title || ''} ${headline || ''}`)
  if (!combined || combined.length < 3) return 'Other'
  
  for (const [func, patterns] of Object.entries(FUNCTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (combined.includes(pattern)) {
        return func as InferredFunction
      }
    }
  }
  
  return 'Other'
}

function detectIndustry(companyName: string | undefined | null, apolloIndustry: string | undefined | null): string {
  if (apolloIndustry) return apolloIndustry
  
  if (!companyName) return 'Unknown'
  const normalizedCompany = normalize(companyName)
  
  for (const [industry, patterns] of Object.entries(INDUSTRY_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalizedCompany.includes(pattern)) {
        return industry
      }
    }
  }
  
  return 'Unknown'
}

function detectCompanyStage(companyName: string | undefined | null): string {
  if (!companyName) return 'Unknown'
  const normalizedCompany = normalize(companyName)
  
  // Check for enterprise companies
  for (const enterprise of ENTERPRISE_COMPANIES) {
    if (normalizedCompany.includes(enterprise)) {
      return 'Enterprise / Fortune 500'
    }
  }
  
  // Check for growth indicators
  for (const indicator of GROWTH_STAGE_INDICATORS) {
    if (normalizedCompany.includes(indicator)) {
      return 'Growth-stage startup'
    }
  }
  
  // If company name is very long, might be established
  if (companyName.length > 25) {
    return 'Established company'
  }
  
  return 'Unknown'
}

function getYearsRange(seniority: InferredSeniority): string {
  switch (seniority) {
    case 'Junior': return '0–2 years'
    case 'Mid-level': return '2–5 years'
    case 'Senior': return '5–8 years'
    case 'Lead': return '6–10 years'
    case 'Director+': return '10+ years'
    default: return 'Unknown'
  }
}

function generateIdealRoles(func: InferredFunction, seniority: InferredSeniority, industry: string): string[] {
  const roles: string[] = []
  
  if (func === 'Sales') {
    if (seniority === 'Senior' || seniority === 'Lead') {
      roles.push('Enterprise Account Executive', 'Strategic Account Manager')
    } else if (seniority === 'Mid-level') {
      roles.push('Mid-Market Account Executive', 'Account Executive')
    } else if (seniority === 'Junior') {
      roles.push('Sales Development Representative', 'Business Development Rep')
    } else if (seniority === 'Director+') {
      roles.push('VP of Sales', 'Head of Sales', 'Sales Director')
    }
  } else if (func === 'Engineering') {
    if (seniority === 'Senior' || seniority === 'Lead') {
      roles.push('Senior Software Engineer', 'Staff Engineer', 'Tech Lead')
    } else if (seniority === 'Mid-level') {
      roles.push('Software Engineer', 'Full Stack Developer')
    } else if (seniority === 'Junior') {
      roles.push('Junior Developer', 'Software Engineer I')
    } else if (seniority === 'Director+') {
      roles.push('Engineering Manager', 'VP of Engineering', 'CTO')
    }
  } else if (func === 'Customer Success') {
    if (seniority === 'Senior' || seniority === 'Lead') {
      roles.push('Senior Customer Success Manager', 'Enterprise CSM')
    } else if (seniority === 'Mid-level') {
      roles.push('Customer Success Manager', 'Account Manager')
    } else if (seniority === 'Director+') {
      roles.push('Director of Customer Success', 'VP of CS')
    }
  } else if (func === 'Marketing') {
    if (seniority === 'Senior' || seniority === 'Lead') {
      roles.push('Senior Marketing Manager', 'Growth Lead')
    } else if (seniority === 'Mid-level') {
      roles.push('Marketing Manager', 'Content Manager')
    } else if (seniority === 'Director+') {
      roles.push('CMO', 'VP of Marketing', 'Head of Growth')
    }
  } else if (func === 'Product') {
    if (seniority === 'Senior' || seniority === 'Lead') {
      roles.push('Senior Product Manager', 'Principal PM')
    } else if (seniority === 'Mid-level') {
      roles.push('Product Manager', 'Associate PM')
    } else if (seniority === 'Director+') {
      roles.push('Director of Product', 'VP of Product', 'CPO')
    }
  }
  
  // Add industry-specific suffix if relevant
  if (industry !== 'Unknown' && roles.length > 0 && industry.includes('SaaS')) {
    roles.push(roles[0] + ' (SaaS)')
  }
  
  return roles.length > 0 ? roles.slice(0, 3) : ['Similar roles in ' + func]
}

export function inferCareerSnapshotFromPreview(args: {
  candidateTitle?: string | null
  companyName?: string | null
  headline?: string | null
  apolloIndustry?: string | null
}): CareerSnapshotInference {
  const { candidateTitle, companyName, headline, apolloIndustry } = args
  
  const seniority = detectSeniority(candidateTitle)
  const functionLabel = detectFunction(candidateTitle, headline)
  const industryLabel = detectIndustry(companyName, apolloIndustry)
  const companyStageLabel = detectCompanyStage(companyName)
  const yearsRangeLabel = getYearsRange(seniority)
  const idealRoleExamples = generateIdealRoles(functionLabel, seniority, industryLabel)
  
  // Generate caveats - kept minimal and neutral
  const caveats: string[] = []
  
  if (!candidateTitle) {
    caveats.push('Role inferred from limited data')
  }
  if (industryLabel === 'Unknown') {
    caveats.push('Industry not confirmed')
  }
  if (seniority === 'Unknown') {
    caveats.push('Experience level estimated')
  }
  
  // Always add the location caveat for preview data
  caveats.push('Location not provided in preview')
  
  return {
    seniority,
    yearsRangeLabel,
    functionLabel,
    industryLabel,
    companyStageLabel,
    idealRoleExamples,
    caveats
  }
}

export function compareCandidateToJob(args: {
  jobTitle?: string | null
  jobSeniority?: string | null
  jobLocation?: string | null
  jobIndustry?: string | null
  candidate: CareerSnapshotInference
  candidateTitle?: string | null
  candidateLocation?: string | null
}): JobComparisonSummary {
  const { jobTitle, jobSeniority, jobLocation, jobIndustry, candidate, candidateTitle, candidateLocation } = args
  const notes: string[] = []
  
  // Title match
  let titleMatchLabel: JobComparisonSummary['titleMatchLabel'] = 'Unknown'
  if (jobTitle && candidateTitle) {
    const normalizedJob = normalize(jobTitle)
    const normalizedCandidate = normalize(candidateTitle)
    
    // Check for direct function match
    const jobWords = normalizedJob.split(/\s+/).filter(w => w.length > 2)
    const candidateWords = normalizedCandidate.split(/\s+/).filter(w => w.length > 2)
    const matchingWords = jobWords.filter(jw => candidateWords.some(cw => jw.includes(cw) || cw.includes(jw)))
    
    if (matchingWords.length >= 2 || normalizedJob.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedJob)) {
      titleMatchLabel = 'Strong'
      notes.push(`Title closely matches ${jobTitle}`)
    } else if (matchingWords.length >= 1) {
      titleMatchLabel = 'Medium'
      notes.push('Some title overlap detected')
    } else {
      // Check if same function at least
      const jobFunc = detectFunction(jobTitle, null)
      if (jobFunc === candidate.functionLabel && candidate.functionLabel !== 'Other') {
        titleMatchLabel = 'Medium'
        notes.push(`Same functional area: ${candidate.functionLabel}`)
      } else {
        titleMatchLabel = 'Weak'
        notes.push('Title may differ from target role')
      }
    }
  } else if (!jobTitle) {
    titleMatchLabel = 'Unknown'
  } else {
    titleMatchLabel = 'Unknown'
    notes.push('Candidate title not available in preview')
  }
  
  // Location match - Unknown is truly neutral, not weak
  let locationMatchLabel: JobComparisonSummary['locationMatchLabel'] = 'Unknown'
  if (!candidateLocation) {
    locationMatchLabel = 'Unknown'
    notes.push('Location not provided — verify on LinkedIn if critical')
  } else if (jobLocation) {
    const normalizedJobLoc = normalize(jobLocation)
    const normalizedCandidateLoc = normalize(candidateLocation)
    
    if (normalizedJobLoc.includes(normalizedCandidateLoc) || normalizedCandidateLoc.includes(normalizedJobLoc)) {
      locationMatchLabel = 'Strong'
    } else {
      // Check country level
      const jobCountry = normalizedJobLoc.split(',').pop()?.trim()
      const candidateCountry = normalizedCandidateLoc.split(',').pop()?.trim()
      if (jobCountry && candidateCountry && (jobCountry.includes(candidateCountry) || candidateCountry.includes(jobCountry))) {
        locationMatchLabel = 'Medium'
        notes.push('Same country, different city')
      } else {
        locationMatchLabel = 'Weak'
        notes.push(`Location (${candidateLocation}) may not match ${jobLocation}`)
      }
    }
  }
  
  // Industry match
  let industryMatchLabel: JobComparisonSummary['industryMatchLabel'] = 'Unknown'
  if (candidate.industryLabel !== 'Unknown' && jobIndustry) {
    const normalizedJobInd = normalize(jobIndustry)
    const normalizedCandidateInd = normalize(candidate.industryLabel)
    
    if (normalizedJobInd.includes(normalizedCandidateInd) || normalizedCandidateInd.includes(normalizedJobInd)) {
      industryMatchLabel = 'Strong'
      notes.push(`Industry aligns: ${candidate.industryLabel}`)
    } else if (
      (normalizedJobInd.includes('saas') && normalizedCandidateInd.includes('software')) ||
      (normalizedJobInd.includes('tech') && normalizedCandidateInd.includes('saas'))
    ) {
      industryMatchLabel = 'Medium'
      notes.push('Related industry experience')
    } else {
      industryMatchLabel = 'Weak'
    }
  } else if (candidate.industryLabel === 'Unknown') {
    industryMatchLabel = 'Unknown'
    notes.push('Industry inferred from company name')
  }
  
  // Seniority match
  let seniorityMatchLabel: JobComparisonSummary['seniorityMatchLabel'] = 'Unknown'
  if (jobSeniority && candidate.seniority !== 'Unknown') {
    const normalizedJobSen = normalize(jobSeniority)
    const candidateSenNorm = normalize(candidate.seniority)
    
    const seniorityOrder = ['junior', 'mid-level', 'senior', 'lead', 'director+']
    const jobLevel = seniorityOrder.findIndex(s => normalizedJobSen.includes(s) || s.includes(normalizedJobSen))
    const candidateLevel = seniorityOrder.findIndex(s => candidateSenNorm.includes(s))
    
    if (jobLevel >= 0 && candidateLevel >= 0) {
      const diff = Math.abs(jobLevel - candidateLevel)
      if (diff === 0) {
        seniorityMatchLabel = 'Strong'
        notes.push(`Seniority matches: ${candidate.seniority}`)
      } else if (diff === 1) {
        seniorityMatchLabel = 'Medium'
        notes.push(`Seniority close: candidate is ${candidate.seniority}`)
      } else {
        seniorityMatchLabel = 'Weak'
        notes.push(`May be ${candidateLevel > jobLevel ? 'overqualified' : 'underqualified'} for the role`)
      }
    }
  } else if (candidate.seniority !== 'Unknown') {
    // We have candidate seniority but no job seniority
    seniorityMatchLabel = 'Unknown'
    notes.push(`Candidate appears ${candidate.seniority} level`)
  }
  
  return {
    titleMatchLabel,
    locationMatchLabel,
    industryMatchLabel,
    seniorityMatchLabel,
    notes: notes.slice(0, 5) // Limit to 5 notes
  }
}

// Recommendation type with new 'low_data' option
export type GioRecommendationType = 'worth_unlocking' | 'borderline' | 'probably_skip' | 'low_data'

export interface GioRecommendation {
  label: string
  type: GioRecommendationType
  description?: string
}

/**
 * Get recommendation based on score AND confidence
 * Never show "probably skip" when confidence is low
 * 
 * New thresholds:
 * - ≥65 with confidence ≥40% → worth_unlocking
 * - 45-64 → borderline
 * - <45 → probably_skip (only if confidence ≥40%)
 * - confidence <40% → low_data (never probably_skip)
 */
export function getRecommendation(score: number, confidence: number = 100): GioRecommendation {
  // Low confidence = never confidently recommend skipping
  if (confidence < 40) {
    return { 
      label: 'Low data', 
      type: 'low_data',
      description: 'Not enough preview data to make a confident recommendation.'
    }
  }
  
  // High confidence recommendations
  if (score >= 65) {
    return { 
      label: 'Worth unlocking', 
      type: 'worth_unlocking',
      description: 'Strong match based on available data.'
    }
  } else if (score >= 45) {
    return { 
      label: 'Borderline', 
      type: 'borderline',
      description: 'Some alignment detected. Review details before deciding.'
    }
  } else {
    return { 
      label: 'Probably skip', 
      type: 'probably_skip',
      description: 'Lower match score based on available signals.'
    }
  }
}

/**
 * Generate candidate-specific "Why this is worth a look" summary
 * 
 * CRITICAL RULES (enforced):
 * 1. 1-2 sentences maximum
 * 2. Recruiter-to-founder tone (opinionated, direct)
 * 3. MUST reference at least one candidate-specific signal:
 *    - Current role/title
 *    - Company or industry
 *    - Specific overlap with search (skills, function, seniority, domain, location)
 *    - OR a specific tradeoff/uncertainty
 * 4. Honest about inference - never invent facts
 * 5. Avoid generic phrasing that could apply to anyone
 * 
 * BANNED PHRASES (hard ban):
 * - "Good alignment overall"
 * - "Looks like a director+ marketing professional" (unless followed by specific signal)
 * - Any statement that just repeats the role without insight
 */
export function generateEnrichedGioTake(
  snapshot: CareerSnapshotInference,
  comparison: JobComparisonSummary,
  score: number,
  confidence: number = 100,
  candidateData?: {
    candidateName?: string | null
    currentRole?: string | null
    currentCompany?: string | null
    location?: string | null
    headline?: string | null
  },
  searchCriteria?: {
    titleKeywords?: string[]
    locations?: string[]
    seniorities?: string[]
    skills?: string[]
  }
): string {
  const role = candidateData?.currentRole
  const company = candidateData?.currentCompany
  const location = candidateData?.location
  
  // Count available signals for determining approach
  const hasRole = !!role && role.length > 2
  const hasCompany = !!company && company.length > 1
  const hasLocation = !!location && location.length > 2
  const hasStrongTitle = comparison.titleMatchLabel === 'Strong'
  const hasMediumTitle = comparison.titleMatchLabel === 'Medium'
  const hasStrongLocation = comparison.locationMatchLabel === 'Strong'
  const hasIndustrySignal = snapshot.industryLabel !== 'Unknown'
  
  const signalCount = [hasRole, hasCompany, hasLocation].filter(Boolean).length
  
  // LOW DATA FALLBACK: Be honest when signals are weak
  if (confidence < 40 || signalCount < 2) {
    if (hasRole && hasCompany) {
      return `Currently ${role} at ${company}. Broadly aligned on title, but limited standout signal from public data — worth a quick skim before unlocking.`
    }
    if (hasRole) {
      return `${role} — title looks relevant. Limited preview data available, so verify fit on LinkedIn before spending a credit.`
    }
    return `Limited preview data available. Worth a quick skim on LinkedIn to see if there's a fit before unlocking.`
  }
  
  // STRONG MATCH: Lead with the specific distinguishing signal
  if (score >= 65 && hasStrongTitle) {
    // Build candidate-specific insight
    if (hasCompany && hasIndustrySignal) {
      return `${role} at ${company} — ${snapshot.industryLabel} experience with a title that matches your search. Worth the unlock.`
    }
    if (hasCompany) {
      return `${role} at ${company}. Title aligns well with what you're looking for.`
    }
    if (hasLocation && hasStrongLocation) {
      return `${role} based in ${location}. Strong title match and location fit — check this one.`
    }
    return `${role} — direct title match to your search. Looks promising.`
  }
  
  // MEDIUM/DECENT MATCH: Acknowledge fit with specific context
  if (score >= 45) {
    // Has company context
    if (hasCompany && hasIndustrySignal) {
      if (hasMediumTitle) {
        return `${role} at ${company} (${snapshot.industryLabel}). Title is close but not exact — could be a fit depending on specific skills.`
      }
      return `${snapshot.seniority} ${snapshot.functionLabel.toLowerCase()} from ${company}. Background in ${snapshot.industryLabel} could be relevant.`
    }
    
    if (hasCompany) {
      if (hasMediumTitle) {
        return `${role} at ${company}. Similar function to your search — worth reviewing the profile.`
      }
      return `Currently at ${company} as ${role}. May overlap with your needs.`
    }
    
    // Location as differentiator
    if (hasLocation && hasStrongLocation && searchCriteria?.locations?.length) {
      return `${role} based in ${location} — location matches. Check if the role experience aligns.`
    }
    
    // Seniority match
    if (snapshot.seniority !== 'Unknown' && comparison.seniorityMatchLabel === 'Strong') {
      return `${snapshot.seniority}-level ${snapshot.functionLabel.toLowerCase()}. Seniority fits, but verify specific experience.`
    }
    
    // Fallback with honesty
    return `${role}${hasCompany ? ` at ${company}` : ''}. Decent match on paper — worth a quick look.`
  }
  
  // LOWER MATCH: Be honest about tradeoffs
  if (hasRole && hasCompany) {
    if (comparison.titleMatchLabel === 'Weak') {
      return `${role} at ${company}. Title doesn't obviously match, but might have transferable experience worth checking.`
    }
    if (comparison.locationMatchLabel === 'Weak' && hasLocation) {
      return `${role} at ${company}, but based in ${location}. Location mismatch — skip if that's a dealbreaker.`
    }
  }
  
  // FINAL FALLBACK: Honest uncertainty
  if (hasRole) {
    return `${role}${hasCompany ? ` at ${company}` : ''} — lower match based on available signals, but you might spot something I missed.`
  }
  
  return `Limited standout signals from public data. Worth a quick LinkedIn check before deciding.`
}

// Generate "Why this score" explanation bullets
export function generateScoreExplanation(
  snapshot: CareerSnapshotInference,
  comparison: JobComparisonSummary,
  confidence: number = 100
): string[] {
  const bullets: string[] = []
  
  // Title
  if (comparison.titleMatchLabel === 'Strong') {
    bullets.push('Title: Strong match for the role')
  } else if (comparison.titleMatchLabel === 'Medium') {
    bullets.push('Title: Partial alignment detected')
  } else if (comparison.titleMatchLabel === 'Weak') {
    bullets.push('Title: May not match target role')
  } else {
    bullets.push('Title: Limited data to assess')
  }
  
  // Skills/Function
  if (snapshot.functionLabel !== 'Other') {
    bullets.push(`Function: ${snapshot.functionLabel} background inferred`)
  } else {
    bullets.push('Skills: Using neutral default (no data)')
  }
  
  // Location
  if (comparison.locationMatchLabel === 'Strong') {
    bullets.push('Location: Matches job requirements')
  } else if (comparison.locationMatchLabel === 'Unknown') {
    bullets.push('Location: Not available — neutral score applied')
  } else if (comparison.locationMatchLabel === 'Medium') {
    bullets.push('Location: Same region, may differ on city')
  } else {
    bullets.push('Location: May not match requirements')
  }
  
  // Confidence note if low
  if (confidence < 40) {
    bullets.push('⚠️ Low confidence: Limited preview signals available')
  }
  
  return bullets
}
