import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useState } from 'react'
import { triggerFitAnalysis } from '@/utils/triggerFitAnalysis'

export interface FitDimension {
  name: string
  score: number | null
  weight: number
  matches?: string[]
  gaps?: string[]
  insight: string | null
}

export interface ValidationPoint {
  question: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  suggested_stage: string
  status?: 'validated' | 'flagged' | null
}

export interface FitAnalysis {
  overall_score: number
  confidence: 'low' | 'medium' | 'high'
  confidence_reason: string
  executive_summary: string
  dimensions: FitDimension[]
  validation_points: ValidationPoint[]
  data_sources_used: string[]
  data_sources_missing: string[]
}

export interface FitInsightsData {
  score: number | null
  analysis: FitAnalysis | null
  confidence: string | null
  generatedAt: string | null
  version: number
  associationId: string
}

export function useCandidateFitInsights(candidateId: string | null, jobId: string | null) {
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const queryKey = ['candidate-fit-insights', candidateId, jobId]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<FitInsightsData | null> => {
      if (!candidateId || !jobId) return null

      const { data: assoc, error } = await supabase
        .from('job_candidate_associations')
        .select('id, ai_fit_score, ai_fit_analysis, ai_fit_confidence, ai_fit_generated_at, ai_fit_version')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .maybeSingle()

      if (error) throw error
      if (!assoc) return null

      return {
        score: assoc.ai_fit_score,
        analysis: assoc.ai_fit_analysis as unknown as FitAnalysis | null,
        confidence: assoc.ai_fit_confidence,
        generatedAt: assoc.ai_fit_generated_at,
        version: assoc.ai_fit_version || 0,
        associationId: assoc.id,
      }
    },
    enabled: !!candidateId && !!jobId,
  })

  const refreshInsights = async () => {
    if (!candidateId || !jobId) return
    setIsRefreshing(true)
    try {
      await triggerFitAnalysis(candidateId, jobId)
      await queryClient.invalidateQueries({ queryKey })
    } finally {
      setIsRefreshing(false)
    }
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  return {
    insights: data ?? null,
    isLoading,
    isRefreshing,
    error,
    refreshInsights,
    invalidate,
  }
}
