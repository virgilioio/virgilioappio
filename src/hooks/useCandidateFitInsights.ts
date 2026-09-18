import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useCallback, useRef, useState } from 'react'
import { requestFitAnalysis } from '@/utils/triggerFitAnalysis'

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
  /** True when candidate/job inputs changed after the stored analysis was generated. */
  isStale: boolean
  staleReason: string | null
}

export function useCandidateFitInsights(candidateId: string | null, jobId: string | null) {
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isDeferred, setIsDeferred] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const queryKey = ['candidate-fit-insights', candidateId, jobId]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<FitInsightsData | null> => {
      if (!candidateId || !jobId) return null

      const { data: assoc, error } = await supabase
        .from('job_candidate_associations')
        .select('id, ai_fit_score, ai_fit_analysis, ai_fit_confidence, ai_fit_generated_at, ai_fit_version, output_language, ai_fit_output_language, ai_fit_keep_proper_nouns, entered_stage_at, job:jobs!inner(output_language, organization:organizations!inner(default_output_language))')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .maybeSingle()

      if (error) throw error
      if (!assoc) return null

      const jobRelation = assoc.job as unknown as { output_language?: string | null; organization?: { default_output_language?: string | null } | null }
      const workspaceOutputLanguage = jobRelation?.organization?.default_output_language || 'en'
      const jobOutputLanguage = jobRelation?.output_language || null
      const outputLanguage = assoc.output_language || null

      // Staleness: only real new information about the candidate justifies
      // spending credits on a regeneration. Timestamps already stored, no new columns.
      let isStale = false
      let staleReason: string | null = null
      const generatedAt = assoc.ai_fit_generated_at
      if (assoc.ai_fit_analysis && generatedAt) {
        const generatedMs = new Date(generatedAt).getTime()
        const newer = (value: string | null | undefined) =>
          Boolean(value) && new Date(value as string).getTime() > generatedMs

        const [resume, scorecard] = await Promise.all([
          supabase
            .from('candidate_attachments')
            .select('created_at')
            .eq('candidate_id', candidateId)
            .eq('is_resume', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('job_stage_scorecards')
            .select('updated_at')
            .eq('candidate_id', candidateId)
            .eq('job_id', jobId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        if (newer(assoc.entered_stage_at)) {
          isStale = true
          staleReason = 'The candidate moved stage'
        } else if (newer(scorecard.data?.updated_at)) {
          isStale = true
          staleReason = 'A new scorecard was submitted'
        } else if (newer(resume.data?.created_at)) {
          isStale = true
          staleReason = 'A new resume was uploaded'
        }
      }

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
        isStale,
        staleReason,
      }
    },
    enabled: !!candidateId && !!jobId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const refreshInsights = useCallback(async () => {
    if (!candidateId || !jobId) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setGenerationError(null)
    setIsBlocked(false)
    setIsDeferred(false)
    setIsRefreshing(true)
    try {
      // A 202 means enrichment is still landing. Keep the loading state and poll;
      // a deferral is never surfaced as an error.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const status = await requestFitAnalysis(candidateId, jobId, controller.signal)
        if (status === 'no_job_description') {
          setIsBlocked(true)
          return
        }
        if (status === 'ok') {
          setIsDeferred(false)
          await queryClient.invalidateQueries({ queryKey })
          return
        }
        setIsDeferred(true)
        await new Promise((resolve) => setTimeout(resolve, 6000))
        if (controller.signal.aborted) return
      }
      setGenerationError('deferred')
    } catch (error) {
      // Cancelling restores the previous dossier untouched — not a failure.
      if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return
      setGenerationError(error instanceof Error ? error.message : 'The assessment could not be completed')
      throw error
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsRefreshing(false)
      setIsDeferred(false)
    }
  }, [candidateId, jobId, queryClient])

  /** Aborts an in-flight run. Stored ai_fit_* columns are never touched by a cancel. */
  const cancelRefresh = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsRefreshing(false)
    setIsDeferred(false)
  }, [])

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
    isDeferred,
    isBlocked,
    generationError,
    error,
    refreshInsights,
    cancelRefresh,
    updateLanguagePreferences,
    invalidate,
  }
}
