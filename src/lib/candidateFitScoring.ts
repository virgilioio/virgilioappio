/**
 * Client-side candidate fit scoring utilities
 * These calculate match scores based on available preview data vs job/sourcing criteria
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
  confidence: number // 0-100, how much data we have to make this assessment
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
  if (!title) return { level: 'unknown', score: 0 }
  
  const normalizedTitle = normalize(title)
  
  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedTitle.includes(keyword)) {
        const scores: Record<string, number> = {
          executive: 100,
          director: 85,
          senior: 70,
          mid: 50,
          junior: 30
        }
        return { level, score: scores[level] || 50 }
      }
    }
  }
  
  return { level: 'mid', score: 50 } // Default to mid-level
}

/**
 * Calculate headline keyword density (professional relevance)
 */
function calculateHeadlineQuality(headline: string | undefined): number {
  if (!headline) return 0
  
  const normalizedHeadline = normalize(headline)
  const words = normalizedHeadline.split(/\s+/)
  
  if (words.length === 0) return 0
  
  let matchCount = 0
  for (const keyword of PROFESSIONAL_KEYWORDS) {
    if (normalizedHeadline.includes(keyword)) {
      matchCount++
    }
  }
  
  // Score based on keyword density (max ~5 keywords for full score)
  return Math.min(100, (matchCount / 5) * 100)
}

/**
 * Calculate data richness score - how complete is the profile
 */
function calculateDataRichness(candidate: CandidatePreviewData): number {
  let score = 0
  const weights = {
    candidate_name: 10,
    current_role: 25,
    headline: 20,
    current_company: 15,
    location: 15,
    industry: 10,
    has_email: 3,
    has_phone: 2
  }
  
  if (candidate.candidate_name && candidate.candidate_name.length > 3) score += weights.candidate_name
  if (candidate.current_role && candidate.current_role.length > 2) score += weights.current_role
  if (candidate.headline && candidate.headline.length > 10) score += weights.headline
  if (candidate.current_company && candidate.current_company.length > 1) score += weights.current_company
  if (candidate.location && candidate.location.length > 2) score += weights.location
  if (candidate.industry) score += weights.industry
  if (candidate.has_email) score += weights.has_email
  if (candidate.has_phone) score += weights.has_phone
  
  return Math.min(100, score)
}

/**
 * Calculate role alignment score (0-100)
 */
function calculateRoleScore(
  currentRole: string | undefined,
  titleKeywords: string[] | undefined
): number {
  if (!currentRole) {
    return 25 // Low score if no role data
  }
  
  if (!titleKeywords || titleKeywords.length === 0) {
    // No criteria - use seniority as a proxy for quality
    const seniority = detectSeniority(currentRole)
    return Math.max(40, seniority.score) // Minimum 40 to show we have data
  }

  const normalizedRole = normalize(currentRole)
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
  const baseScore = ((matchCount * 100) + (partialCount * 60)) / totalKeywords
  
  // Add seniority bonus (up to 15 points)
  const seniority = detectSeniority(currentRole)
  const seniorityBonus = Math.min(15, seniority.score * 0.15)
  
  return Math.min(100, Math.round(baseScore + seniorityBonus))
}

/**
 * Calculate skills match score from headline (0-100)
 */
function calculateSkillsScore(
  headline: string | undefined,
  currentRole: string | undefined,
  skills: string[] | undefined,
  keywords: string[] | undefined
): number {
  const textToSearch = normalize(`${headline || ''} ${currentRole || ''}`)
  
  if (!textToSearch || textToSearch.length < 5) {
    return 20 // Very low if no text to analyze
  }

  const searchTerms = [...(skills || []), ...(keywords || [])]
  
  if (searchTerms.length === 0) {
    // No criteria - use headline quality as proxy
    const headlineQuality = calculateHeadlineQuality(headline)
    return Math.max(35, Math.min(75, 35 + headlineQuality * 0.4)) // Range 35-75
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

  const baseScore = (matchCount / searchTerms.length) * 100
  
  // Add headline quality bonus (up to 10 points)
  const headlineQuality = calculateHeadlineQuality(headline)
  const qualityBonus = Math.min(10, headlineQuality * 0.1)
  
  return Math.min(100, Math.round(baseScore + qualityBonus))
}

/**
 * Calculate location match score (0-100)
 */
function calculateLocationScore(
  candidateLocation: string | undefined,
  searchLocations: string[] | undefined
): number {
  if (!searchLocations || searchLocations.length === 0) {
    // No location requirement
    return candidateLocation ? 85 : 60 // Bonus for having location data
  }

  if (!candidateLocation) {
    return 30 // Unknown location when we have requirements
  }

  const normalizedCandidateLocation = normalize(candidateLocation)
  
  for (const loc of searchLocations) {
    const normalizedLoc = normalize(loc)
    // Check for any meaningful overlap
    if (normalizedCandidateLocation.includes(normalizedLoc) || 
        normalizedLoc.includes(normalizedCandidateLocation) ||
        hasOverlap(normalizedCandidateLocation, normalizedLoc)) {
      return 100
    }
  }

  // Check for country-level match
  const candidateCountry = normalizedCandidateLocation.split(/[,\s]+/).pop() || ''
  for (const loc of searchLocations) {
    const locCountry = normalize(loc).split(/[,\s]+/).pop() || ''
    if (candidateCountry && locCountry && (
      candidateCountry.includes(locCountry) || locCountry.includes(candidateCountry)
    )) {
      return 65 // Country match but not city
    }
  }

  return 20 // No location match
}

/**
 * Convert numeric score to tier label
 */
function scoreToTier(score: number): 'low' | 'medium' | 'high' {
  if (score >= 65) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

/**
 * Calculate overall fit score for a candidate
 */
export function calculateFitScore(
  candidate: CandidatePreviewData,
  criteria: SearchCriteria | undefined
): FitScore {
  // Calculate data richness first
  const dataRichness = calculateDataRichness(candidate)
  
  // Calculate individual scores
  const roleScore = calculateRoleScore(candidate.current_role, criteria?.title_keywords)
  const skillsScore = calculateSkillsScore(
    candidate.headline, 
    candidate.current_role,
    criteria?.skills,
    criteria?.keywords
  )
  const locationScore = calculateLocationScore(candidate.location, criteria?.locations)

  // Weighted average: Role 40%, Skills 35%, Location 25%
  let overall = Math.round(
    (roleScore * 0.4) + (skillsScore * 0.35) + (locationScore * 0.25)
  )
  
  // Apply data richness modifier (±10 points based on profile completeness)
  const richnessModifier = ((dataRichness - 50) / 50) * 10
  overall = Math.max(10, Math.min(95, Math.round(overall + richnessModifier)))

  // Calculate confidence based on available data AND criteria
  let confidence = 0
  if (candidate.current_role) confidence += 25
  if (candidate.headline) confidence += 20
  if (candidate.location) confidence += 15
  if (candidate.current_company) confidence += 15
  if (candidate.industry) confidence += 10
  
  // Boost confidence if we have criteria to match against
  const hasCriteria = criteria && (
    (criteria.title_keywords?.length ?? 0) > 0 ||
    (criteria.skills?.length ?? 0) > 0 ||
    (criteria.locations?.length ?? 0) > 0
  )
  if (hasCriteria) confidence += 15

  return {
    overall,
    roleAlignment: scoreToTier(roleScore),
    skillsMatch: scoreToTier(skillsScore),
    locationMatch: scoreToTier(locationScore),
    confidence: Math.min(100, confidence),
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
  } else {
    concerns.push('Current role unknown')
  }

  // Analyze company
  if (candidate.current_company) {
    strengths.push(`Working at ${candidate.current_company}`)
  }

  // Analyze location
  if (fitScore.locationMatch === 'high' && candidate.location) {
    strengths.push(`Based in ${candidate.location}`)
  } else if (fitScore.locationMatch === 'low' && criteria?.locations?.length) {
    if (candidate.location) {
      concerns.push(`Location (${candidate.location}) may not match`)
    } else {
      concerns.push('Location not confirmed')
    }
  }

  // Analyze skills from headline
  if (candidate.headline && fitScore.skillsMatch === 'high') {
    const headlineQuality = calculateHeadlineQuality(candidate.headline)
    if (headlineQuality > 50) {
      // Extract key terms that might be skills
      const matchedSkills = (criteria?.skills || []).filter(s => 
        normalize(candidate.headline || '').includes(normalize(s))
      ).slice(0, 3)
      if (matchedSkills.length > 0) {
        strengths.push(`Profile highlights: ${matchedSkills.join(', ')}`)
      } else {
        strengths.push('Strong professional background')
      }
    }
  } else if (fitScore.skillsMatch === 'low' && criteria?.skills?.length) {
    concerns.push('Key skills not evident in profile')
  }

  // Industry context
  if (candidate.industry) {
    strengths.push(`${candidate.industry} background`)
  }

  // Data richness concern
  if (fitScore.dataRichness < 40) {
    concerns.push('Limited profile information available')
  }

  // Generate summary based on overall score and data quality
  let summary = ''
  
  if (fitScore.confidence < 40) {
    // Low confidence - emphasize uncertainty
    summary = `Limited data to assess fit. ${candidate.current_role ? `Currently ${candidate.current_role}` : 'Role unknown'}${candidate.current_company ? ` at ${candidate.current_company}` : ''}.`
  } else if (fitScore.overall >= 70) {
    summary = `Strong potential match. ${candidate.current_role ? `Currently serving as ${candidate.current_role}` : 'Experienced professional'}${candidate.current_company ? ` at ${candidate.current_company}` : ''}.`
  } else if (fitScore.overall >= 50) {
    summary = `Worth reviewing. ${candidate.current_role || 'Professional'}${candidate.current_company ? ` at ${candidate.current_company}` : ''} with some alignment to your criteria.`
  } else if (fitScore.overall >= 35) {
    summary = `Partial match. ${concerns.length > 0 ? concerns[0] + '.' : 'Review profile for potential fit.'}`
  } else {
    summary = `Limited match. ${concerns.length > 0 ? concerns[0] + '.' : 'May not align with current search criteria.'}`
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
  if (score >= 80) return 'Excellent fit'
  if (score >= 65) return 'Strong fit'
  if (score >= 50) return 'Good fit'
  if (score >= 35) return 'Fair fit'
  return 'Low fit'
}

/**
 * Get color class for fit score
 */
export function getFitScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 65) return 'text-emerald-600'
  if (score >= 50) return 'text-blue-600'
  if (score >= 35) return 'text-amber-600'
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
  if (confidence >= 70) return 'High confidence'
  if (confidence >= 45) return 'Moderate confidence'
  return 'Low confidence'
}
