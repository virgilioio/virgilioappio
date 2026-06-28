
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import type { JobStage } from '@/hooks/useJobStages'

export type HiringPlanInstance = {
  jhsId: string
  stage: JobStage
  position: number
  customStageName?: string | null
}

export type HiringPlanInput = {
  /** Existing job_hiring_stages.id, or undefined for a new instance to insert. */
  jhsId?: string
  /** Library stage id (job_stages.id). */
  stage_id: string
  customStageName?: string | null
}

export function useJobHiringPlan() {
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const { toast } = useToast()

  /**
   * Returns the ordered list of library stages used by this job's plan,
   * preserving duplicates (one entry per job_hiring_stages row).
   */
  const loadHiringPlan = useCallback(async (jobId: string): Promise<JobStage[]> => {
    const instances = await loadHiringPlanInstancesInternal(jobId)
    return instances.map((i) => i.stage)
  }, [])

  const loadHiringPlanInstancesInternal = async (jobId: string): Promise<HiringPlanInstance[]> => {
    const { data: planEntries, error: planError } = await supabase
      .from('job_hiring_stages')
      .select('id, stage_id, position, custom_stage_name')
      .eq('job_id', jobId)
      .order('position', { ascending: true })

    if (planError) throw planError
    if (!planEntries || planEntries.length === 0) return []

    const stageIds = Array.from(new Set(planEntries.map((e: any) => e.stage_id)))
    const { data: stages, error: stagesError } = await supabase
      .from('job_stages')
      .select('*')
      .in('id', stageIds)
      .eq('is_active', true)

    if (stagesError) throw stagesError

    const byId = new Map(stages.map((s: any) => [s.id, s]))
    const ordered: HiringPlanInstance[] = planEntries
      .map((e: any) => {
        const s = byId.get(e.stage_id)
        return s
          ? { jhsId: e.id, stage: s as JobStage, position: e.position, customStageName: e.custom_stage_name }
          : null
      })
      .filter(Boolean) as HiringPlanInstance[]

    return ordered
  }

  const loadHiringPlanInstances = useCallback(async (jobId: string): Promise<HiringPlanInstance[]> => {
    setIsLoadingPlan(true)
    try {
      return await loadHiringPlanInstancesInternal(jobId)
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

  /**
   * Save the hiring plan as an ordered list of instances.
   * - Entries with an existing `jhsId` are kept (and re-ordered).
   * - Entries without `jhsId` are inserted as new rows (duplicates of the same `stage_id` allowed).
   * - Existing rows whose `jhsId` is not in `entries` are deleted (candidates reassigned to the previous stage).
   */
  const saveHiringPlan = useCallback(async (jobId: string, entries: HiringPlanInput[]) => {
    setIsSavingPlan(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const userId = userData.user?.id ?? null

      const { data: currentPlan, error: currentPlanError } = await supabase
        .from('job_hiring_stages')
        .select('id, stage_id, position')
        .eq('job_id', jobId)
        .order('position', { ascending: true })
      if (currentPlanError) throw currentPlanError

      const currentById = new Map<string, { id: string; stage_id: string; position: number }>()
      for (const row of currentPlan || []) currentById.set(row.id, row)

      const incomingJhsIds = new Set<string>()
      const toKeep: { jhsId: string; stage_id: string }[] = []
      const toInsert: { stage_id: string; customStageName?: string | null; insertIndex: number }[] = []

      entries.forEach((e, idx) => {
        if (e.jhsId && currentById.has(e.jhsId)) {
          incomingJhsIds.add(e.jhsId)
          toKeep.push({ jhsId: e.jhsId, stage_id: e.stage_id })
        } else {
          toInsert.push({ stage_id: e.stage_id, customStageName: e.customStageName ?? null, insertIndex: idx })
        }
      })

      const toDelete = (currentPlan || []).filter((row) => !incomingJhsIds.has(row.id))

      // Phase 0: park all current rows in a unique temp block (30000+)
      for (let i = 0; i < (currentPlan || []).length; i++) {
        const { error: normErr } = await supabase
          .from('job_hiring_stages')
          .update({ position: 30000 + i + 1 })
          .eq('id', currentPlan[i].id)
        if (normErr) throw normErr
      }

      // Phase 1: temp positions for kept rows (10000+)
      for (let i = 0; i < toKeep.length; i++) {
        const { error: tmpErr } = await supabase
          .from('job_hiring_stages')
          .update({ position: 10000 + (i + 1) })
          .eq('id', toKeep[i].jhsId)
        if (tmpErr) throw tmpErr
      }

      // Phase 2: insert new rows with distinct temp positions (20000+)
      const insertedJhsIdByInsertIndex = new Map<number, string>()
      if (toInsert.length > 0) {
        const payload = toInsert.map((s, idx) => ({
          job_id: jobId,
          stage_id: s.stage_id,
          custom_stage_name: s.customStageName,
          position: 20000 + (idx + 1),
          created_by: userId,
        }))
        const { data: insertedRows, error: insertErr } = await supabase
          .from('job_hiring_stages')
          .insert(payload)
          .select('id, position')
        if (insertErr) throw insertErr
        // Map back by the temp position we assigned
        for (const row of insertedRows || []) {
          const tempIdx = (row.position as number) - 20000 - 1
          const original = toInsert[tempIdx]
          if (original) insertedJhsIdByInsertIndex.set(original.insertIndex, row.id)
        }
      }

      // Build final ordered jhsId list (matches `entries` order)
      const finalOrderedJhsIds: string[] = []
      const keptByEntry = new Map<string, true>()
      for (const k of toKeep) keptByEntry.set(k.jhsId, true)

      entries.forEach((e, idx) => {
        if (e.jhsId && keptByEntry.has(e.jhsId)) {
          finalOrderedJhsIds.push(e.jhsId)
        } else {
          const newId = insertedJhsIdByInsertIndex.get(idx)
          if (newId) finalOrderedJhsIds.push(newId)
        }
      })

      // Phase 3: reassign candidates away from removed rows, then delete
      if (finalOrderedJhsIds.length === 0) {
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
        const finalWithPos = finalOrderedJhsIds.map((jhsId, idx) => ({ jhsId, pos: idx + 1 }))
        for (const removed of toDelete) {
          const previous = finalWithPos
            .filter((s) => s.pos < (removed.position ?? Number.MAX_SAFE_INTEGER))
            .sort((a, b) => b.pos - a.pos)[0] || finalWithPos[0]

          const targetJhsId = previous?.jhsId ?? null

          const { error: moveErr } = await supabase
            .from('job_candidate_associations')
            .update({ current_stage_id: targetJhsId, pipeline_position: null })
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

      // Phase 4: finalize positions 1..n
      for (let i = 0; i < finalOrderedJhsIds.length; i++) {
        const { error: finErr } = await supabase
          .from('job_hiring_stages')
          .update({ position: i + 1 })
          .eq('id', finalOrderedJhsIds[i])
        if (finErr) throw finErr
      }

      toast({
        title: 'Hiring Plan Saved',
        description: 'The hiring plan has been successfully saved.',
      })

      return finalOrderedJhsIds
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
