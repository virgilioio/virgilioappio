import { useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useRejectCandidate } from '@/hooks/useRejectCandidate'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

export interface ReviewCandidate {
  candidateId: string
  associationId: string
  candidateName: string
  email: string | null
  phone: string | null
  locationCity: string | null
  locationCountry: string | null
  locationState: string | null
  source: string | null
  appliedAt: string
  linkedinUrl: string | null
  profileSummary: string | null
  skills: string[] | null
  currentJobTitle: string | null
  seniority: string | null
}

export interface RejectionConfig {
  rejectionReasonId?: string
  sendEmail: boolean
  rejectionNotes?: string
}

export interface ReviewSessionStats {
  rejected: number
  passed: number
  advanced: number
}

export function useApplicationReview(jobId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const rejectCandidate = useRejectCandidate()
  const { moveAssociationToStage, createAssociationAndMove } = usePipelineActions()

  const [queue, setQueue] = useState<ReviewCandidate[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const [firstStageId, setFirstStageId] = useState<string | null>(null)
  const [firstStageName, setFirstStageName] = useState<string | null>(null)
  const [stats, setStats] = useState<ReviewSessionStats>({ rejected: 0, passed: 0, advanced: 0 })
  const [rejectionConfig, setRejectionConfig] = useState<RejectionConfig>(() => {
    try {
      const stored = localStorage.getItem('app-review-rejection-config')
      if (stored) return JSON.parse(stored)
    } catch {}
    return { sendEmail: false }
  })

  const isComplete = currentIndex >= queue.length && queue.length > 0
  const currentCandidate = queue[currentIndex] ?? null
  const totalInQueue = queue.length
  const currentPosition = currentIndex + 1

  const persistRejectionConfig = useCallback((config: RejectionConfig) => {
    setRejectionConfig(config)
    try {
      localStorage.setItem('app-review-rejection-config', JSON.stringify(config))
    } catch {}
  }, [])

  const loadQueue = useCallback(async () => {
    if (!jobId || !user) return
    setIsLoading(true)
    setStats({ rejected: 0, passed: 0, advanced: 0 })
    setCurrentIndex(0)

    try {
      // Find the application_review hiring stage for this job
      const { data: arStages, error: arError } = await supabase
        .from('job_hiring_stages')
        .select('id, stage:job_stages!inner(stage_type)')
        .eq('job_id', jobId)
        .eq('stage:job_stages.stage_type', 'application_review' as any)

      if (arError) throw arError

      const arStageId = arStages?.[0]?.id
      if (!arStageId) {
        setQueue([])
        setIsLoading(false)
        return
      }

      // Get all associations in the application_review stage
      const { data: associations, error: assocError } = await supabase
        .from('job_candidate_associations')
        .select(`
          id,
          created_at,
          candidates!inner(
            id,
            candidate_name,
            email,
            phone,
            location_city,
            location_country,
            location_state,
            source,
            linkedin_url,
            profile_summary,
            skills,
            current_job_title,
            seniority_level
          )
        `)
        .eq('job_id', jobId)
        .eq('status', 'active')
        .eq('current_stage_id', arStageId)
        .order('created_at', { ascending: true })

      if (assocError) throw assocError

      const reviewCandidates: ReviewCandidate[] = (associations || []).map((a: any) => {
        const c = a.candidates
        return {
          candidateId: c.id,
          associationId: a.id,
          candidateName: c.candidate_name,
          email: c.email,
          phone: c.phone,
          locationCity: c.location_city,
          locationCountry: c.location_country,
          locationState: c.location_state,
          source: c.source,
          appliedAt: a.created_at,
          linkedinUrl: c.linkedin_url,
          profileSummary: c.profile_summary,
          skills: c.skills,
          currentJobTitle: c.current_job_title,
          seniority: c.seniority_level,
        }
      })

      setQueue(reviewCandidates)

      // Load the first NON-application_review pipeline stage for this job
      const { data: stages, error: stagesError } = await supabase
        .from('job_hiring_stages')
        .select('id, position, stage:job_stages!inner(stage_name, stage_type)')
        .eq('job_id', jobId)
        .neq('stage:job_stages.stage_type', 'application_review' as any)
        .order('position', { ascending: true })

      if (!stagesError && stages && stages.length > 0) {
        setFirstStageId(stages[0].id)
        setFirstStageName((stages[0].stage as any)?.stage_name || 'First Stage')
      }
    } catch (error) {
      console.error('Failed to load application review queue:', error)
      toast({ title: 'Error', description: 'Failed to load review queue.', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [jobId, user])

  const moveToNext = useCallback(() => {
    setCurrentIndex(prev => prev + 1)
  }, [])

  const navigateTo = useCallback((index: number) => {
    if (index >= 0 && index < queue.length) {
      setCurrentIndex(index)
    }
  }, [queue.length])

  const handleReject = useCallback(async () => {
    if (!currentCandidate || isActioning) return
    setIsActioning(true)

    try {
      await rejectCandidate.mutateAsync({
        associationId: currentCandidate.associationId,
        rejectionReasonId: rejectionConfig.rejectionReasonId,
        rejectionNotes: rejectionConfig.rejectionNotes,
        sendEmail: false, // For speed in review mode, no email by default via the dialog
      })

      setStats(prev => ({ ...prev, rejected: prev.rejected + 1 }))
      moveToNext()
    } catch (error) {
      console.error('Rejection failed:', error)
    } finally {
      setIsActioning(false)
    }
  }, [currentCandidate, isActioning, rejectionConfig, rejectCandidate, moveToNext])

  const handlePass = useCallback(() => {
    if (!currentCandidate) return
    setStats(prev => ({ ...prev, passed: prev.passed + 1 }))
    moveToNext()
  }, [currentCandidate, moveToNext])

  const handleAdvance = useCallback(async () => {
    if (!currentCandidate || !firstStageId || isActioning) return
    setIsActioning(true)

    try {
      await moveAssociationToStage(currentCandidate.associationId, firstStageId, { silent: true })
      
      toast({
        title: 'Candidate advanced',
        description: `${currentCandidate.candidateName} moved to ${firstStageName}`,
      })

      setStats(prev => ({ ...prev, advanced: prev.advanced + 1 }))
      moveToNext()
    } catch (error) {
      console.error('Advance failed:', error)
      toast({ title: 'Error', description: 'Failed to advance candidate.', variant: 'destructive' })
    } finally {
      setIsActioning(false)
    }
  }, [currentCandidate, firstStageId, firstStageName, isActioning, moveAssociationToStage, moveToNext])

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['job-candidates'] })
    queryClient.invalidateQueries({ queryKey: ['pipeline'] })
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
  }, [queryClient])

  return {
    queue,
    currentCandidate,
    currentIndex,
    currentPosition,
    totalInQueue,
    isComplete,
    isLoading,
    isActioning,
    firstStageId,
    firstStageName,
    stats,
    rejectionConfig,
    loadQueue,
    handleReject,
    handlePass,
    handleAdvance,
    navigateTo,
    persistRejectionConfig,
    invalidateQueries,
  }
}
