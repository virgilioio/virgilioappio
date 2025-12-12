/**
 * Client-side candidate fit scoring utilities
 * Redesigned for sparse Apollo preview data (only title + company typically available)
 * 
 * Key principles:
 * - Role dominates scoring (60%) since title+company are only reliable signals
 * - Missing data = neutral (50), not penalty
 * - Confidence tracks data availability separately from score
 * - Low confidence prevents "probably skip" recommendations
 */

import type { SearchCriteria } from '@/types/sourcing'

export interface CandidatePreviewData {
  candidate_name: string
  headline?: string
  location?: string
  current_company?: string
  current_role?: string
  industry?: string
  has_email?: boolean
  has_phone?: boolean
  has_location?: boolean
}

export interface FitScore {
  overall: number // 0-100
  roleAlignment: 'low' | 'medium' | 'high'
  skillsMatch: 'low' | 'medium' | 'high'
  locationMatch: 'low' | 'medium' | 'high'
  confidence: number // 0-100, based on data availability
  dataRichness: number // 0-100, how complete is the candidate's profile
}

export interface GioTake {
  summary: string
  strengths: string[]
  concerns: string[]
}

// Seniority keywords for title analysis
const SENIORITY_KEYWORDS = {
  executive: ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'chief', 'president', 'founder', 'co-founder', 'partner'],
  director: ['director', 'vp', 'vice president', 'head of', 'head'],
  senior: ['senior', 'sr', 'lead', 'principal', 'staff', 'architect'],
  mid: ['manager', 'specialist', 'analyst', 'engineer', 'developer', 'designer'],
  junior: ['junior', 'jr', 'associate', 'assistant', 'intern', 'trainee', 'entry']
}

// Professional keywords that indicate strong profiles
const PROFESSIONAL_KEYWORDS = [
  'engineer', 'developer', 'architect', 'manager', 'director', 'lead',
  'consultant', 'analyst', 'specialist', 'designer', 'product', 'data',
  'software', 'frontend', 'backend', 'fullstack', 'devops', 'cloud',
  'mobile', 'ios', 'android', 'react', 'python', 'java', 'typescript',
  'machine learning', 'ai', 'ml', 'strategy', 'operations', 'marketing',
  'sales', 'business', 'finance', 'hr', 'recruiting', 'talent'
]

// Title-based skill archetypes for inference when skills aren't available
const TITLE_SKILL_ARCHETYPES: Record<string, string[]> = {
  sales: ['enterprise sales', 'saas sales', 'negotiation', 'crm', 'pipeline management', 'quota attainment'],
  ae: ['account management', 'sales', 'negotiation', 'crm', 'closing'],
  sdr: ['outbound sales', 'cold calling', 'prospecting', 'lead generation', 'email campaigns'],
  bdr: ['business development', 'prospecting', 'lead qualification', 'outreach'],
  engineer: ['software development', 'coding', 'architecture', 'debugging', 'system design'],
  developer: ['programming', 'software', 'coding', 'web development'],
  product: ['product management', 'roadmap', 'user research', 'agile', 'stakeholder management'],
  marketing: ['digital marketing', 'campaigns', 'analytics', 'brand', 'content'],
  data: ['analytics', 'sql', 'data analysis', 'visualization', 'insights'],
  customer: ['customer success', 'account management', 'retention', 'onboarding', 'support']
}

/**
 * Normalize a string for comparison (lowercase, trim, remove special chars)
 */
function normalize(str: string | undefined | null): string {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '')
}

/**
 * Check if two strings have meaningful overlap
 */
function hasOverlap(a: string, b: string): boolean {
  const wordsA = normalize(a).split(/\s+/).filter(w => w.length > 2)
  const wordsB = normalize(b).split(/\s+/).filter(w => w.length > 2)
  return wordsA.some(wa => wordsB.some(wb => wa.includes(wb) || wb.includes(wa)))
}

/**
 * Detect seniority level from job title
 */
function detectSeniority(title: string | undefined): { level: string; score: number } {
  if (!title) return { level: 'unknown', score: 50 } // Neutral when unknown
  
  const normalizedTitle = normalize(title)
  
  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedTitle.includes(keyword)) {
        const scores: Record<string, number> = {
          executive: 100,
          director: 85,
          senior: 75,
          mid: 60,
          junior: 45
        }
        return { level, score: scores[level] || 60 }
      }
    }
  }
  
  return { level: 'mid', score: 60 } // Default to mid-level with neutral-positive score
}

/**
 * Calculate headline keyword density (professional relevance)
 */
function calculateHeadlineQuality(headline: string | undefined): number {
  if (!headline) return 50 // Neutral when missing, not penalty
  
  const normalizedHeadline = normalize(headline)
  const words = normalizedHeadline.split(/\s+/)
  
  if (words.length === 0) return 50
  
  let matchCount = 0
  for (const keyword of PROFESSIONAL_KEYWORDS) {
    if (normalizedHeadline.includes(keyword)) {
      matchCount++
    }
  }
  
  // Score based on keyword density (max ~5 keywords for full score)
  // Range from 50 (no keywords) to 100 (5+ keywords)
  return Math.min(100, 50 + (matchCount / 5) * 50)
}

/**
 * Calculate data richness score - how complete is the profile
 * Used for confidence calculation, NOT as a penalty
 */
function calculateDataRichness(candidate: CandidatePreviewData): number {
  let score = 0
  const weights = {
    candidate_name: 10,
    current_role: 30,  // Title is most important signal
    current_company: 25, // Company is second most important
    headline: 20,
    location: 10,
    industry: 5
  }
  
  if (candidate.candidate_name && candidate.candidate_name.length > 3) score += weights.candidate_name
  if (candidate.current_role && candidate.current_role.length > 2) score += weights.current_role
  if (candidate.current_company && candidate.current_company.length > 1) score += weights.current_company
  if (candidate.headline && candidate.headline.length > 10) score += weights.headline
  if (candidate.location && candidate.location.length > 2) score += weights.location
  if (candidate.industry) score += weights.industry
  
  return Math.min(100, score)
}

/**
 * Calculate confidence based on available preview signals
 * Each signal contributes to confidence - this determines how reliable our score is
 */
function calculateConfidence(candidate: CandidatePreviewData): number {
  let confidence = 0
  
  // Title and company are the primary signals (33% each)
  if (candidate.current_role && candidate.current_role.length > 2) confidence += 33
  if (candidate.current_company && candidate.current_company.length > 1) confidence += 33
  
  // Headline provides additional context
  if (candidate.headline && candidate.headline.length > 10) confidence += 20
  
  // Location helps with fit assessment
  if (candidate.location && candidate.location.length > 2) confidence += 14
  
  return Math.min(100, confidence)
}

/**
 * Infer skills from title when actual skills aren't available
 */
function inferSkillsFromTitle(title: string | undefined): string[] {
  if (!title) return []
  const normalizedTitle = normalize(title)
  
  for (const [keyword, skills] of Object.entries(TITLE_SKILL_ARCHETYPES)) {
    if (normalizedTitle.includes(keyword)) {
      return skills
    }
  }
  
  return []
}

/**
 * Calculate role alignment score (0-100)
 * Now enhanced to give stronger scores for good title matches
 */
function calculateRoleScore(
  currentRole: string | undefined,
  headline: string | undefined,
  currentCompany: string | undefined,
  titleKeywords: string[] | undefined
): number {
  // No role = neutral, not penalty
  if (!currentRole) {
    return 50
  }
  
  const normalizedRole = normalize(currentRole)
  const seniority = detectSeniority(currentRole)
  
  // No criteria - use seniority and role quality as proxy
  if (!titleKeywords || titleKeywords.length === 0) {
    // Base score from seniority (45-85 range)
    let score = Math.max(45, Math.min(85, seniority.score))
    
    // Bonus for having a company (professional signal)
    if (currentCompany) score += 5
    
    // Bonus for headline quality
    const headlineQuality = calculateHeadlineQuality(headline)
    if (headlineQuality > 60) score += 5
    
    return Math.min(100, score)
  }

  let matchCount = 0
  let partialCount = 0

  for (const keyword of titleKeywords) {
    const normalizedKeyword = normalize(keyword)
    if (normalizedRole.includes(normalizedKeyword)) {
      matchCount++
    } else if (hasOverlap(normalizedRole, normalizedKeyword)) {
      partialCount++
    }
  }

  const totalKeywords = titleKeywords.length
  
  // Calculate base score - boosted for matches
  // Full match = 100, partial = 65
  const baseScore = totalKeywords > 0 
    ? ((matchCount * 100) + (partialCount * 65)) / totalKeywords
    : 50

  // Add seniority bonus (up to 10 points)
  const seniorityBonus = Math.min(10, (seniority.score - 50) * 0.2)
  
  // Company bonus (up to 5 points)
  const companyBonus = currentCompany ? 5 : 0
  
  // Ensure strong matches get high scores (60-95 range typically)
  const finalScore = Math.max(35, Math.min(95, baseScore + seniorityBonus + companyBonus))
  
  return Math.round(finalScore)
}

/**
 * Calculate skills match score from headline and title inference (0-100)
 * Uses neutral defaults when data is missing
 */
function calculateSkillsScore(
  headline: string | undefined,
  currentRole: string | undefined,
  skills: string[] | undefined,
  keywords: string[] | undefined
): number {
  const textToSearch = normalize(`${headline || ''} ${currentRole || ''}`)
  
  // No text = neutral, not penalty
  if (!textToSearch || textToSearch.length < 5) {
    return 50
  }

  const searchTerms = [...(skills || []), ...(keywords || [])]
  
  // No criteria - infer skills from title and return neutral-positive
  if (searchTerms.length === 0) {
    const inferredSkills = inferSkillsFromTitle(currentRole)
    if (inferredSkills.length > 0) {
      // Have inferred skills = slightly positive (55-70)
      const headlineQuality = calculateHeadlineQuality(headline)
      return Math.min(70, 55 + headlineQuality * 0.15)
    }
    // No inference possible = neutral
    return 50
  }

  let matchCount = 0
  for (const skill of searchTerms) {
    const normalizedSkill = normalize(skill)
    if (textToSearch.includes(normalizedSkill)) {
      matchCount++
    } else {
      // Check for partial/word matches
      const words = normalizedSkill.split(/\s+/)
      if (words.some(w => w.length > 2 && textToSearch.includes(w))) {
        matchCount += 0.5
      }
    }
  }

  // Base score from matches
  const matchRatio = matchCount / searchTerms.length
  
  if (matchRatio === 0) {
    // No matches found - check for inferred skills from title
    const inferredSkills = inferSkillsFromTitle(currentRole)
    if (inferredSkills.length > 0) {
      // Check if inferred skills overlap with search terms
      const inferredMatch = searchTerms.some(s => 
        inferredSkills.some(is => normalize(is).includes(normalize(s)) || normalize(s).includes(normalize(is)))
      )
      if (inferredMatch) return 60 // Inferred match = slight positive
    }
    return 50 // No match = neutral, not penalty
  }
  
  // Scale: 0% = 50, 100% = 100
  const baseScore = 50 + (matchRatio * 50)
  
  return Math.min(100, Math.round(baseScore))
}

/**
 * Calculate location match score (0-100)
 * Unknown location = 50 (neutral), not penalty
 */
function calculateLocationScore(
  candidateLocation: string | undefined,
  searchLocations: string[] | undefined
): number {
  // No location requirement = neutral-positive (having any location is good)
  if (!searchLocations || searchLocations.length === 0) {
    return candidateLocation ? 70 : 50
  }

  // Unknown location = neutral (50), NOT penalty
  if (!candidateLocation) {
    return 50
  }

  const normalizedCandidateLocation = normalize(candidateLocation)
  
  // Check for exact/close match
  for (const loc of searchLocations) {
    const normalizedLoc = normalize(loc)
    if (normalizedCandidateLocation.includes(normalizedLoc) || 
        normalizedLoc.includes(normalizedCandidateLocation) ||
        hasOverlap(normalizedCandidateLocation, normalizedLoc)) {
      return 100 // Exact match
    }
  }

  // Check for country-level match
  const candidateCountry = normalizedCandidateLocation.split(/[,\s]+/).pop() || ''
  for (const loc of searchLocations) {
    const locCountry = normalize(loc).split(/[,\s]+/).pop() || ''
    if (candidateCountry && locCountry && (
      candidateCountry.includes(locCountry) || locCountry.includes(candidateCountry)
    )) {
      return 70 // Country match but not city
    }
  }

  // Clear mismatch (we have both locations but they don't match)
  return 25
}

/**
 * Convert numeric score to tier label
 */
function scoreToTier(score: number): 'low' | 'medium' | 'high' {
  if (score >= 65) return 'high'
  if (score >= 45) return 'medium'
  return 'low'
}

/**
 * Calculate overall fit score for a candidate
 * New formula: Role 60%, Skills 15%, Location 10%, with richness multiplier (not penalty)
 */
export function calculateFitScore(
  candidate: CandidatePreviewData,
  criteria: SearchCriteria | undefined
): FitScore {
  // Calculate data richness and confidence
  const dataRichness = calculateDataRichness(candidate)
  const confidence = calculateConfidence(candidate)
  
  // Calculate individual scores with new logic
  const roleScore = calculateRoleScore(
    candidate.current_role, 
    candidate.headline,
    candidate.current_company,
    criteria?.title_keywords
  )
  const skillsScore = calculateSkillsScore(
    candidate.headline, 
    candidate.current_role,
    criteria?.skills,
    criteria?.keywords
  )
  const locationScore = calculateLocationScore(candidate.location, criteria?.locations)

  // New weighted average: Role 60%, Skills 15%, Location 10%
  // Remaining 15% is implicit baseline (handled by neutral defaults)
  let overall = Math.round(
    (roleScore * 0.60) + (skillsScore * 0.15) + (locationScore * 0.10) + 
    (50 * 0.15) // Baseline contribution
  )
  
  // Apply data richness MULTIPLIER (not penalty)
  // High richness = up to +5%, low richness = no change (1.0x)
  const richnessMultiplier = dataRichness >= 60 ? 1.05 : 1.0
  overall = Math.round(overall * richnessMultiplier)
  
  // Clamp to reasonable range
  overall = Math.max(25, Math.min(95, overall))

  return {
    overall,
    roleAlignment: scoreToTier(roleScore),
    skillsMatch: scoreToTier(skillsScore),
    locationMatch: scoreToTier(locationScore),
    confidence,
    dataRichness
  }
}

/**
 * Generate "Gio's Take" - a brief AI-like summary of the candidate fit
 */
export function generateGioTake(
  candidate: CandidatePreviewData,
  criteria: SearchCriteria | undefined,
  fitScore: FitScore
): GioTake {
  const strengths: string[] = []
  const concerns: string[] = []

  // Analyze seniority
  const seniority = detectSeniority(candidate.current_role)
  
  // Analyze role
  if (candidate.current_role) {
    if (fitScore.roleAlignment === 'high') {
      if (seniority.level === 'senior' || seniority.level === 'director' || seniority.level === 'executive') {
        strengths.push(`Senior-level ${candidate.current_role}`)
      } else {
        strengths.push(`Currently a ${candidate.current_role}`)
      }
    } else if (fitScore.roleAlignment === 'low' && criteria?.title_keywords?.length) {
      concerns.push(`Role may not align with target titles`)
    }
  }

  // Analyze company
  if (candidate.current_company) {
    strengths.push(`Working at ${candidate.current_company}`)
  }

  // Analyze location - use neutral language for unknown
  if (fitScore.locationMatch === 'high' && candidate.location) {
    strengths.push(`Based in ${candidate.location}`)
  } else if (!candidate.location && criteria?.locations?.length) {
    // Unknown location - neutral, not concern
    concerns.push('Location not confirmed in preview')
  } else if (fitScore.locationMatch === 'low' && candidate.location) {
    concerns.push(`Location (${candidate.location}) may not match`)
  }

  // Analyze skills from headline
  if (candidate.headline && fitScore.skillsMatch === 'high') {
    const matchedSkills = (criteria?.skills || []).filter(s => 
      normalize(candidate.headline || '').includes(normalize(s))
    ).slice(0, 3)
    if (matchedSkills.length > 0) {
      strengths.push(`Profile highlights: ${matchedSkills.join(', ')}`)
    } else {
      strengths.push('Strong professional background')
    }
  }

  // Industry context
  if (candidate.industry) {
    strengths.push(`${candidate.industry} background`)
  }

  // Generate summary based on score AND confidence
  let summary = ''
  
  if (fitScore.confidence < 40) {
    // Low confidence - acknowledge uncertainty without being negative
    summary = `Limited preview data available. ${candidate.current_role ? `Currently ${candidate.current_role}` : ''}${candidate.current_company ? ` at ${candidate.current_company}` : ''}.`
    if (fitScore.overall >= 55) {
      summary += ' Title and company look promising.'
    }
  } else if (fitScore.overall >= 65) {
    summary = `Strong potential match. ${candidate.current_role ? `Currently serving as ${candidate.current_role}` : 'Experienced professional'}${candidate.current_company ? ` at ${candidate.current_company}` : ''}.`
  } else if (fitScore.overall >= 45) {
    summary = `Worth reviewing. ${candidate.current_role || 'Professional'}${candidate.current_company ? ` at ${candidate.current_company}` : ''} with some alignment to your criteria.`
  } else {
    summary = `Lower match score. ${concerns.length > 0 ? concerns[0] + '.' : 'Review profile for potential fit.'}`
  }

  // Add location to summary if relevant and not already mentioned
  if (candidate.location && fitScore.locationMatch === 'high' && !summary.includes(candidate.location)) {
    summary += ` Based in ${candidate.location}.`
  }

  return {
    summary: summary.trim(),
    strengths: strengths.slice(0, 4),
    concerns: concerns.slice(0, 2)
  }
}

/**
 * Get display label for fit score
 */
export function getFitScoreLabel(score: number): string {
  if (score >= 75) return 'Excellent fit'
  if (score >= 65) return 'Strong fit'
  if (score >= 50) return 'Good fit'
  if (score >= 40) return 'Fair fit'
  return 'Lower fit'
}

/**
 * Get color class for fit score
 */
export function getFitScoreColor(score: number): string {
  if (score >= 75) return 'text-green-600'
  if (score >= 65) return 'text-emerald-600'
  if (score >= 50) return 'text-blue-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-orange-600'
}

/**
 * Get background color class for signal bars
 */
export function getSignalBarColor(tier: 'low' | 'medium' | 'high'): string {
  switch (tier) {
    case 'high': return 'bg-green-500'
    case 'medium': return 'bg-amber-500'
    case 'low': return 'bg-red-400'
  }
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 60) return 'High confidence'
  if (confidence >= 40) return 'Medium confidence'
  return 'Low confidence'
}
