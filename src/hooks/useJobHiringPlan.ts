
import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import type { JobStage } from '@/hooks/useJobStages'

type HiringPlanEntry = {
  stage_id: string
  position: number
}

export function useJobHiringPlan() {
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const { toast } = useToast()

  const loadHiringPlan = useCallback(async (jobId: string): Promise<JobStage[]> => {
    setIsLoadingPlan(true)
    try {
      // 1) Load existing plan entries for the job (ordered)
      const { data: planEntries, error: planError } = await supabase
        .from('job_hiring_stages')
        .select('stage_id, position')
        .eq('job_id', jobId)
        .order('position', { ascending: true })

      if (planError) throw planError

      if (!planEntries || planEntries.length === 0) {
        return []
      }

      const stageIds = planEntries.map((e: HiringPlanEntry) => e.stage_id)

      // 2) Load stage details for those ids
      const { data: stages, error: stagesError } = await supabase
        .from('job_stages')
        .select('*')
        .in('id', stageIds)
        .eq('is_active', true)

      if (stagesError) throw stagesError

      const byId = new Map(stages.map((s) => [s.id, s]))
      const ordered: JobStage[] = planEntries
        .map((e: HiringPlanEntry) => byId.get(e.stage_id))
        .filter(Boolean) as JobStage[]

      return ordered
    } catch (error) {
      console.error('Error loading hiring plan:', error)
      toast({
        title: 'Error',
        description: 'Failed to load the hiring plan for this job.',
        variant: 'destructive',
      })
      return []
    } finally {
      setIsLoadingPlan(false)
    }
  }, [toast])

  // Returns plan with job_hiring_stages ids for safe pipeline moves
  type HiringPlanStageOption = { jhsId: string; stage: JobStage; position: number }

  const loadHiringPlanInstances = useCallback(async (jobId: string): Promise<HiringPlanStageOption[]> => {
    setIsLoadingPlan(true)
    try {
      const { data: planEntries, error: planError } = await supabase
        .from('job_hiring_stages')
        .select('id, stage_id, position')
        .eq('job_id', jobId)
        .order('position', { ascending: true })

      if (planError) throw planError
      if (!planEntries || planEntries.length === 0) return []

      const stageIds = planEntries.map((e: { stage_id: string }) => e.stage_id)
      const { data: stages, error: stagesError } = await supabase
        .from('job_stages')
        .select('*')
        .in('id', stageIds)
        .eq('is_active', true)

      if (stagesError) throw stagesError

      const byId = new Map(stages.map((s) => [s.id, s]))
      const ordered: HiringPlanStageOption[] = planEntries
        .map((e: { id: string; stage_id: string; position: number }) => {
          const s = byId.get(e.stage_id)
          return s ? { jhsId: e.id, stage: s, position: e.position } : null
        })
        .filter(Boolean) as HiringPlanStageOption[]

      return ordered
    } catch (error) {
      console.error('Error loading hiring plan instances:', error)
      toast({
        title: 'Error',
        description: 'Failed to load the hiring plan for this job.',
        variant: 'destructive',
      })
      return []
    } finally {
      setIsLoadingPlan(false)
    }
  }, [toast])

  const saveHiringPlan = useCallback(async (jobId: string, stages: { id: string }[]) => {
    setIsSavingPlan(true)
    try {
      // Get current user for created_by
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const userId = userData.user?.id

      // 1) Remove all existing stage positions for this job first to avoid unique position conflicts
      const { error: deleteExistingError } = await supabase
        .from('job_hiring_stages')
        .delete()
        .eq('job_id', jobId)
      if (deleteExistingError) throw deleteExistingError

      // 2) Insert all stage positions in the new order
      if (stages.length > 0) {
        const payload = stages.map((stage, idx) => ({
          job_id: jobId,
          stage_id: stage.id,
          position: idx + 1, // 1-based position
          created_by: userId ?? null,
        }))

        const { error: insertError } = await supabase
          .from('job_hiring_stages')
          .insert(payload)
        if (insertError) throw insertError
      }


      toast({
        title: 'Hiring Plan Saved',
        description: 'The hiring plan has been successfully saved.',
      })
    } catch (error) {
      console.error('Error saving hiring plan:', error)
      toast({
        title: 'Error',
        description: 'Failed to save the hiring plan.',
        variant: 'destructive',
      })
      throw error
    } finally {
      setIsSavingPlan(false)
    }
  }, [toast])

  return {
    isLoadingPlan,
    isSavingPlan,
    loadHiringPlan,
    loadHiringPlanInstances,
    saveHiringPlan,
  }
}

export type { JobStage }
