import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface JobMatchingCount {
  total_count: number
  breakdown: {
    localCandidates: number
    coreSignalCandidates: number
    averageMatch: number
  }
}

interface UseJobMatchingCandidatesCountParams {
  jobId: string
  enabled?: boolean
}

export function useJobMatchingCandidatesCount({
  jobId,
  enabled = true
}: UseJobMatchingCandidatesCountParams) {
  const [countResult, setCountResult] = useState<JobMatchingCount | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMatchingCount = useCallback(async () => {
    if (!enabled || !jobId) {
      setCountResult(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log(`🔢 Fetching matching candidates count for job: ${jobId}`)

      const { data, error } = await supabase.functions.invoke('get-job-matching-candidates', {
        body: {
          job_id: jobId,
          limit: 50,
          count_only: true
        }
      })

      if (error) throw error

      console.log(`✅ Found ${data.total_count || 0} matching candidates`)
      setCountResult(data)
    } catch (err: any) {
      console.error('Error fetching matching candidates count:', err)
      setError(err.message || 'Failed to fetch matching candidates count')
    } finally {
      setIsLoading(false)
    }
  }, [jobId, enabled])

  useEffect(() => {
    fetchMatchingCount()
  }, [fetchMatchingCount])

  const refetch = useCallback(() => {
    fetchMatchingCount()
  }, [fetchMatchingCount])

  return {
    countResult,
    count: countResult?.total_count || 0,
    isLoading,
    error,
    refetch
  }
}