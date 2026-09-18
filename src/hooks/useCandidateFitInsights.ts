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
  verdict?: string | null
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
  profile_summary?: string
  executive_summary: string
  dimensions: FitDimension[]
  validation_points: ValidationPoint[]
  data_sources_used: string[]
  data_sources_missing: string[]
  detected_languages?: {
    summary: string
    confidence: 'low' | 'medium' | 'high'
    sources: Array<{ label: string; code: string; name: string }>
  }
}

export interface FitInsightsData {
  score: number | null
  analysis: FitAnalysis | null
  confidence: string | null
  generatedAt: string | null
  version: number
  associationId: string
  outputLanguage: string | null
  appliedOutputLanguage: string | null
  keepProperNouns: boolean
  jobOutputLanguage: string | null
  workspaceOutputLanguage: string
  resolvedOutputLanguage: string
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
        .select('id, ai_fit_score, ai_fit_analysis, ai_fit_confidence, ai_fit_generated_at, ai_fit_version, output_language, ai_fit_output_language, ai_fit_keep_proper_nouns, job:jobs!inner(output_language, organization:organizations!inner(default_output_language))')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .maybeSingle()

      if (error) throw error
      if (!assoc) return null

      const jobRelation = assoc.job as unknown as { output_language?: string | null; organization?: { default_output_language?: string | null } | null }
      const workspaceOutputLanguage = jobRelation?.organization?.default_output_language || 'en'
      const jobOutputLanguage = jobRelation?.output_language || null
      const outputLanguage = assoc.output_language || null
      return {
        score: assoc.ai_fit_score,
        analysis: assoc.ai_fit_analysis as unknown as FitAnalysis | null,
        confidence: assoc.ai_fit_confidence,
        generatedAt: assoc.ai_fit_generated_at,
        version: assoc.ai_fit_version || 0,
        associationId: assoc.id,
        outputLanguage,
        appliedOutputLanguage: assoc.ai_fit_output_language || null,
        keepProperNouns: assoc.ai_fit_keep_proper_nouns !== false,
        jobOutputLanguage,
        workspaceOutputLanguage,
        resolvedOutputLanguage: outputLanguage || jobOutputLanguage || workspaceOutputLanguage || 'en',
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

  const updateLanguagePreferences = async (outputLanguage: string | null, keepProperNouns: boolean) => {
    if (!data?.associationId) throw new Error('Candidate association is not available')
    const { error } = await supabase
      .from('job_candidate_associations')
      .update({ output_language: outputLanguage, ai_fit_keep_proper_nouns: keepProperNouns })
      .eq('id', data.associationId)
    if (error) throw error
    await refreshInsights()
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
    updateLanguagePreferences,
    invalidate,
  }
}
