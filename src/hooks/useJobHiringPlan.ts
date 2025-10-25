
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
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
  type HiringPlanStageOption = { jhsId: string; stage: JobStage; position: number; customStageName?: string | null }

  const loadHiringPlanInstances = useCallback(async (jobId: string): Promise<HiringPlanStageOption[]> => {
    setIsLoadingPlan(true)
    try {
      const { data: planEntries, error: planError } = await supabase
        .from('job_hiring_stages')
        .select('id, stage_id, position, custom_stage_name')
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
        .map((e: { id: string; stage_id: string; position: number; custom_stage_name?: string | null }) => {
          const s = byId.get(e.stage_id)
          return s ? { jhsId: e.id, stage: s, position: e.position, customStageName: e.custom_stage_name } : null
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
      const userId = userData.user?.id ?? null

      // Load current plan entries for this job
      const { data: currentPlan, error: currentPlanError } = await supabase
        .from('job_hiring_stages')
        .select('id, stage_id, position')
        .eq('job_id', jobId)
        .order('position', { ascending: true })
      if (currentPlanError) throw currentPlanError

      type IncomingStage = { id: string; jhsId?: string }
      const incoming: IncomingStage[] = stages as any

      // Map current plan by stage_id
      const currentByStageId = new Map<string, { id: string; stage_id: string; position: number }>()
      for (const row of currentPlan || []) {
        currentByStageId.set(row.stage_id, row)
      }

      // Determine which to keep, insert, and delete
      const toKeep: { id: string; stage_id: string }[] = []
      const toInsert: { stage_id: string }[] = []
      const incomingStageIds = new Set<string>()

      incoming.forEach((s) => {
        incomingStageIds.add(s.id)
        const existing = currentByStageId.get(s.id)
        if (existing) toKeep.push({ id: existing.id, stage_id: s.id })
        else toInsert.push({ stage_id: s.id })
      })

      const toDelete = (currentPlan || []).filter((row) => !incomingStageIds.has(row.stage_id))

      // Phase 1: Move kept rows to temporary unique positions to avoid unique (job_id, position) conflicts
      // Use a high offset block (10000 + index) guaranteed unique within this save operation
      for (let i = 0; i < toKeep.length; i++) {
        const { error: tmpErr } = await supabase
          .from('job_hiring_stages')
          .update({ position: 10000 + (i + 1) })
          .eq('id', toKeep[i].id)
        if (tmpErr) throw tmpErr
      }

      // Phase 2: Insert new stages with distinct temporary positions in a different block (20000 + index)
      let inserted: { id: string; stage_id: string }[] = []
      if (toInsert.length > 0) {
        const payload = toInsert.map((s, idx) => ({
          job_id: jobId,
          stage_id: s.stage_id,
          position: 20000 + (idx + 1),
          created_by: userId,
        }))
        const { data: insertedRows, error: insertErr } = await supabase
          .from('job_hiring_stages')
          .insert(payload)
          .select('id, stage_id')
        if (insertErr) throw insertErr
        inserted = insertedRows || []
      }

      // Build final mapping and desired order
      const finalStageIds = incoming.map((s) => s.id)
      const finalStageIdToJhsId = new Map<string, string>()
      for (const k of toKeep) finalStageIdToJhsId.set(k.stage_id, k.id)
      for (const ins of inserted) finalStageIdToJhsId.set(ins.stage_id, ins.id)

      // Phase 3: Reassign candidates away from stages being removed, then delete those stages
      if ((toKeep.length + inserted.length) === 0) {
        // Edge case: plan becomes empty -> set associations' stage to NULL first, then delete all
        const { error: updAllErr } = await supabase
          .from('job_candidate_associations')
          .update({ current_stage_id: null, pipeline_position: null })
          .eq('job_id', jobId)
        if (updAllErr) throw updAllErr

        const { error: delAllErr } = await supabase
          .from('job_hiring_stages')
          .delete()
          .eq('job_id', jobId)
        if (delAllErr) throw delAllErr
      } else if (toDelete.length > 0) {
        const finalStagesWithPos = finalStageIds.map((sid, idx) => ({ stage_id: sid, pos: idx + 1 }))
        for (const removed of toDelete) {
          const previous = finalStagesWithPos
            .filter((s) => s.pos < (removed.position ?? Number.MAX_SAFE_INTEGER))
            .sort((a, b) => b.pos - a.pos)[0] || finalStagesWithPos[0]

          const targetStageId = previous?.stage_id
          const targetJhsId = targetStageId ? finalStageIdToJhsId.get(targetStageId) : null

          const updatePayload: any = { pipeline_position: null }
          updatePayload.current_stage_id = targetJhsId ?? null

          const { error: moveErr } = await supabase
            .from('job_candidate_associations')
            .update(updatePayload)
            .eq('job_id', jobId)
            .eq('current_stage_id', removed.id)
          if (moveErr) throw moveErr
        }

        const removedIds = toDelete.map((r) => r.id)
        const { error: delErr } = await supabase
          .from('job_hiring_stages')
          .delete()
          .in('id', removedIds)
        if (delErr) throw delErr
      }

      // Phase 4: Finalize positions to 1..n according to incoming order
      for (let i = 0; i < finalStageIds.length; i++) {
        const sid = finalStageIds[i]
        const jhsId = finalStageIdToJhsId.get(sid)
        if (!jhsId) continue
        const { error: finErr } = await supabase
          .from('job_hiring_stages')
          .update({ position: i + 1 })
          .eq('id', jhsId)
        if (finErr) throw finErr
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
