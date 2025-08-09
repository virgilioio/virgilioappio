
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

      // New safer approach: preserve existing rows, update positions, insert new ones, and
      // reassign candidates from removed stages BEFORE deleting them to avoid FK issues

      // Load current plan entries for this job
      const { data: currentPlan, error: currentPlanError } = await supabase
        .from('job_hiring_stages')
        .select('id, stage_id, position')
        .eq('job_id', jobId)
        .order('position', { ascending: true })
      if (currentPlanError) throw currentPlanError

      // Map current plan by stage_id and keep list by id
      const currentByStageId = new Map<string, { id: string; stage_id: string; position: number }>()
      const currentIds = new Set<string>()
      for (const row of currentPlan || []) {
        currentByStageId.set(row.stage_id, row)
        currentIds.add(row.id)
      }

      // Build desired new order from input
      type IncomingStage = { id: string; jhsId?: string }
      const incoming: IncomingStage[] = stages as any

      // Determine which to keep (existing rows), which to insert, and which to delete
      const toKeep: { id: string; stage_id: string; newPosition: number }[] = []
      const toInsert: { stage_id: string; position: number; job_id: string; created_by: string | null }[] = []
      const incomingStageIds = new Set<string>()

      incoming.forEach((s, idx) => {
        const stage_id = s.id
        incomingStageIds.add(stage_id)
        const existing = currentByStageId.get(stage_id)
        if (existing) {
          toKeep.push({ id: existing.id, stage_id, newPosition: idx + 1 })
        } else {
          toInsert.push({
            job_id: jobId,
            stage_id,
            position: 1000 + (idx + 1), // temporary high position to avoid unique constraint collisions
            created_by: userId ?? null,
          })
        }
      })

      const toDelete = (currentPlan || []).filter((row) => !incomingStageIds.has(row.stage_id))

      // 1) Insert new stages first and capture their IDs
      let inserted: { id: string; stage_id: string; position: number }[] = []
      if (toInsert.length > 0) {
        const { data: insertedRows, error: insertError } = await supabase
          .from('job_hiring_stages')
          .insert(toInsert)
          .select('id, stage_id, position')
        if (insertError) throw insertError
        inserted = insertedRows || []
      }

      // Build final plan map: stage_id -> jhsId and stage_id -> final position
      const finalStageIdToJhsId = new Map<string, string>()
      const finalPositions = new Map<string, number>()

      for (const keep of toKeep) {
        finalStageIdToJhsId.set(keep.stage_id, keep.id)
        finalPositions.set(keep.stage_id, keep.newPosition)
      }
      for (const ins of inserted) {
        finalStageIdToJhsId.set(ins.stage_id, ins.id)
        // Position for newly inserted is already correct in payload
        const incomingPos = incoming.findIndex((s) => s.id === ins.stage_id)
        if (incomingPos >= 0) finalPositions.set(ins.stage_id, incomingPos + 1)
      }

      // 2) Update positions for kept rows if they changed
      for (const keep of toKeep) {
        // Only update if position changed
        const curr = (currentPlan || []).find((r) => r.id === keep.id)
        if (!curr || curr.position !== keep.newPosition) {
          const { error: updErr } = await supabase
            .from('job_hiring_stages')
            .update({ position: keep.newPosition })
            .eq('id', keep.id)
          if (updErr) throw updErr
        }
      }

      // 3) Reassign candidates from stages that are being deleted to the previous remaining stage
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
        // Compute helper: find previous remaining stage by old position
        const finalStagesWithPos = Array.from(finalPositions.entries()) // [stage_id, pos]
          .map(([stage_id, pos]) => ({ stage_id, pos }))

        for (const removed of toDelete) {
          // Find previous remaining stage position strictly less than removed.position
          const previous = finalStagesWithPos
            .filter((s) => s.pos < removed.position)
            .sort((a, b) => b.pos - a.pos)[0]
            || finalStagesWithPos.sort((a, b) => a.pos - b.pos)[0] // if none smaller, pick first

          const targetStageId = previous?.stage_id
          const targetJhsId = targetStageId ? finalStageIdToJhsId.get(targetStageId) : null

          const updatePayload: any = { pipeline_position: null }
          if (targetJhsId) {
            updatePayload.current_stage_id = targetJhsId
          } else {
            updatePayload.current_stage_id = null
          }

          const { error: moveErr } = await supabase
            .from('job_candidate_associations')
            .update(updatePayload)
            .eq('job_id', jobId)
            .eq('current_stage_id', removed.id)
          if (moveErr) throw moveErr
        }

        // After reassignment, delete removed rows
        const removedIds = toDelete.map((r) => r.id)
        const { error: delErr } = await supabase
          .from('job_hiring_stages')
          .delete()
          .in('id', removedIds)
        if (delErr) throw delErr
      }
      // 4) Normalize positions for newly inserted rows to their final positions
      for (const ins of inserted) {
        const finalPos = finalPositions.get(ins.stage_id)
        if (finalPos && ins.position !== finalPos) {
          const { error: updInsErr } = await supabase
            .from('job_hiring_stages')
            .update({ position: finalPos })
            .eq('id', ins.id)
          if (updInsErr) throw updInsErr
        }
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
