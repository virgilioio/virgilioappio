/**
 * Client-side candidate fit scoring utilities
 * These calculate match scores based on available preview data vs job/sourcing criteria
 */

import type { SearchCriteria } from '@/types/sourcing'

interface CandidatePreviewData {
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
}

export interface GioTake {
  summary: string
  strengths: string[]
  concerns: string[]
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
 * Calculate role alignment score (0-100)
 */
function calculateRoleScore(
  currentRole: string | undefined,
  titleKeywords: string[] | undefined
): number {
  if (!currentRole || !titleKeywords || titleKeywords.length === 0) {
    return 50 // Neutral if we can't assess
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
  const score = ((matchCount * 100) + (partialCount * 60)) / totalKeywords
  return Math.min(100, Math.round(score))
}

/**
 * Calculate skills match score from headline (0-100)
 * Since Apollo preview doesn't return skills array, we extract from headline
 */
function calculateSkillsScore(
  headline: string | undefined,
  currentRole: string | undefined,
  skills: string[] | undefined,
  keywords: string[] | undefined
): number {
  const searchTerms = [...(skills || []), ...(keywords || [])]
  if (searchTerms.length === 0) {
    return 50 // Neutral if no skills to match against
  }

  const textToSearch = normalize(`${headline || ''} ${currentRole || ''}`)
  if (!textToSearch) {
    return 30 // Low if no text to analyze
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

  const score = (matchCount / searchTerms.length) * 100
  return Math.min(100, Math.round(score))
}

/**
 * Calculate location match score (0-100)
 */
function calculateLocationScore(
  candidateLocation: string | undefined,
  searchLocations: string[] | undefined
): number {
  if (!searchLocations || searchLocations.length === 0) {
    return 100 // No location requirement = full match
  }

  if (!candidateLocation) {
    return 40 // Unknown location when we have requirements
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
      return 70 // Country match but not city
    }
  }

  return 20 // No location match
}

/**
 * Convert numeric score to tier label
 */
function scoreToTier(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high'
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
  if (!criteria) {
    return {
      overall: 50,
      roleAlignment: 'medium',
      skillsMatch: 'medium',
      locationMatch: 'medium',
      confidence: 20
    }
  }

  const roleScore = calculateRoleScore(candidate.current_role, criteria.title_keywords)
  const skillsScore = calculateSkillsScore(
    candidate.headline, 
    candidate.current_role,
    criteria.skills,
    criteria.keywords
  )
  const locationScore = calculateLocationScore(candidate.location, criteria.locations)

  // Weighted average: Role 40%, Skills 35%, Location 25%
  const overall = Math.round(
    (roleScore * 0.4) + (skillsScore * 0.35) + (locationScore * 0.25)
  )

  // Calculate confidence based on available data
  let confidence = 0
  if (candidate.current_role) confidence += 30
  if (candidate.headline) confidence += 25
  if (candidate.location) confidence += 20
  if (candidate.current_company) confidence += 15
  if (candidate.industry) confidence += 10

  return {
    overall,
    roleAlignment: scoreToTier(roleScore),
    skillsMatch: scoreToTier(skillsScore),
    locationMatch: scoreToTier(locationScore),
    confidence: Math.min(100, confidence)
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

  // Analyze role
  if (candidate.current_role) {
    if (fitScore.roleAlignment === 'high') {
      strengths.push(`Currently a ${candidate.current_role}`)
    } else if (fitScore.roleAlignment === 'low' && criteria?.title_keywords?.length) {
      concerns.push(`Role "${candidate.current_role}" may not align with target titles`)
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
      concerns.push(`Location (${candidate.location}) doesn't match search criteria`)
    } else {
      concerns.push('Location not confirmed')
    }
  }

  // Analyze skills from headline
  if (candidate.headline && fitScore.skillsMatch === 'high') {
    // Extract key terms that might be skills
    const headlineLower = candidate.headline.toLowerCase()
    const matchedSkills = (criteria?.skills || []).filter(s => 
      headlineLower.includes(s.toLowerCase())
    ).slice(0, 3)
    if (matchedSkills.length > 0) {
      strengths.push(`Profile highlights: ${matchedSkills.join(', ')}`)
    }
  } else if (fitScore.skillsMatch === 'low' && criteria?.skills?.length) {
    concerns.push('Key skills not evident in profile summary')
  }

  // Industry context
  if (candidate.industry) {
    strengths.push(`${candidate.industry} background`)
  }

  // Generate summary
  let summary = ''
  if (fitScore.overall >= 70) {
    summary = `Strong potential match. ${candidate.current_role ? `Currently serving as ${candidate.current_role}` : 'Experienced professional'}${candidate.current_company ? ` at ${candidate.current_company}` : ''}.`
  } else if (fitScore.overall >= 50) {
    summary = `Worth reviewing. ${candidate.current_role || 'Professional'}${candidate.current_company ? ` at ${candidate.current_company}` : ''} with some alignment to your search criteria.`
  } else {
    summary = `Limited match with current criteria. ${concerns.length > 0 ? concerns[0] + '.' : 'Review profile for potential fit.'}`
  }

  // Add location to summary if relevant
  if (candidate.location && fitScore.locationMatch === 'high') {
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
