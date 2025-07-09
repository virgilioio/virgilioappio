import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface SkillMatchingData {
  totalCandidates: number
  excellent: number
  good: number
  fair: number
  minimal: number
  breakdown: {
    salaryMatches: number
    locationMatches: number
    skillsAnalysis: {
      averageMatch: number
      topSkills: string[]
    }
  }
}

interface UseRealTimeSkillMatchingParams {
  skills: string[]
  location?: string
  salaryMin?: number
  salaryMax?: number
  currency?: string
  debounceMs?: number
}

export function useRealTimeSkillMatching({
  skills,
  location,
  salaryMin,
  salaryMax,
  currency = 'USD',
  debounceMs = 500
}: UseRealTimeSkillMatchingParams) {
  const [matchingData, setMatchingData] = useState<SkillMatchingData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchCandidateMatching = useCallback(async () => {
    if (!skills.length) {
      setMatchingData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.functions.invoke('count-matching-candidates', {
        body: {
          skills,
          location,
          salary_min: salaryMin,
          salary_max: salaryMax,
          currency
        }
      })

      if (error) throw error

      setMatchingData(data)
    } catch (err: any) {
      console.error('Error fetching candidate matching:', err)
      setError(err.message || 'Failed to fetch candidate matching data')
    } finally {
      setIsLoading(false)
    }
  }, [skills, location, salaryMin, salaryMax, currency])

  // Debounced effect for API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCandidateMatching()
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [fetchCandidateMatching, debounceMs])

  const refetch = useCallback(() => {
    fetchCandidateMatching()
  }, [fetchCandidateMatching])

  return {
    matchingData,
    isLoading,
    error,
    refetch
  }
}