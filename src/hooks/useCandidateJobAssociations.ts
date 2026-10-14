import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

// ── Legacy hook used by CandidateJobSidebar / MobileJobSelector ──

export interface CandidateJobAssociation {
  id: string
  job_id: string
  status: string | null
  current_stage_id: string | null
  created_at?: string | null
  entered_stage_at?: string | null
  rejected_at?: string | null
  hired_at?: string | null
  offered_at?: string | null
  job: {
    id: string
    title: string
    department?: string | null
    organization: {
      name: string
    } | null
  }
  current_stage?: {
    custom_stage_name: string | null
    stage: { stage_name: string | null } | null
  } | null
}

export function useCandidateJobAssociations(candidateId: string | null) {
  const [jobAssociations, setJobAssociations] = useState<CandidateJobAssociation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchAssociations = async () => {
    if (!candidateId) {
      setJobAssociations([])
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select(`
          id,
          job_id,
          status,
          current_stage_id,
          created_at,
          entered_stage_at,
          rejected_at,
          hired_at,
          offered_at,
          job:jobs!inner (
            id,
            title,
            department,
            organization:organizations (
              name
            )
          ),
          current_stage:job_hiring_stages (
            custom_stage_name,
            stage:job_stages (
              stage_name
            )
          )
        `)
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setJobAssociations(data || [])
    } catch (error) {
      console.error('Error fetching candidate job associations:', error)
      toast.error('Failed to load job associations')
      setJobAssociations([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAssociations()
  }, [candidateId])

  return {
    jobAssociations,
    isLoading,
    refetch: fetchAssociations
  }
}

// ── Bulk hook: associations for many candidates at once ──

export interface AssociationDetail {
  associationId: string
  candidateId: string
  jobId: string
  jobTitle: string
  stageName: string | null
  /** The stage as this job names it (custom name first). */
  stageLabel: string | null
  pipelineStatus: string | null
  enteredStageAt: string | null
  bookingLinkSentAt: string | null
  rejectedAt: string | null
  offeredAt: string | null
  hiredAt: string | null
  createdAt: string
  /** Who put them in this job's pipeline; null when they applied themselves. */
  addedBy: string | null
  isFavorite: boolean
  /** How far along the job's stages their current stage is: 0 = first, 1 = last. */
  stageProgress: number | null
}

export type AssociationsMap = Map<string, AssociationDetail[]>

export function useCandidateJobAssociationsMap(candidateIds: string[]) {
  const [associations, setAssociations] = useState<AssociationDetail[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (candidateIds.length === 0) {
      setAssociations([])
      return
    }

    const fetchAll = async () => {
      setIsLoading(true)
      try {
        // Fetch associations with job title and stage name via joins
        const chunkSize = 200
        const allData: any[] = []

        for (let i = 0; i < candidateIds.length; i += chunkSize) {
          const chunk = candidateIds.slice(i, i + chunkSize)
          const { data, error } = await supabase
            .from('job_candidate_associations')
            .select(`
              id,
              candidate_id,
              job_id,
              status,
              current_stage_id,
              entered_stage_at,
              booking_link_sent_at,
              rejected_at,
              offered_at,
              hired_at,
              created_at,
              added_by,
              is_favorite,
              jobs!inner(id, title),
              job_hiring_stages!job_candidate_associations_current_stage_id_fkey(
                id,
                position,
                custom_stage_name,
                job_stages!job_hiring_stages_stage_id_fkey(stage_name)
              )
            `)
            .in('candidate_id', chunk)

          if (error) {
            console.error('Error fetching associations chunk:', error)
            continue
          }
          if (data) allData.push(...data)
        }

        // Every stage position of each job, to say how far along a stage is
        // ("Furthest in pipeline" sort, 2026-10-14).
        const jobIds = [...new Set(allData.map((a: any) => a.job_id as string))]
        const positionsByJob = new Map<string, number[]>()
        for (let i = 0; i < jobIds.length; i += 100) {
          const { data: stages, error: stagesError } = await supabase
            .from('job_hiring_stages')
            .select('job_id, position')
            .in('job_id', jobIds.slice(i, i + 100))
          if (stagesError) {
            console.error('Error fetching job stages for progress:', stagesError)
            continue
          }
          for (const st of stages ?? []) {
            const list = positionsByJob.get(st.job_id) ?? []
            list.push(st.position ?? 0)
            positionsByJob.set(st.job_id, list)
          }
        }
        const progressOf = (jobId: string, position: number | null | undefined) => {
          if (position == null) return null
          const sorted = [...new Set(positionsByJob.get(jobId) ?? [])].sort((x, y) => x - y)
          if (sorted.length <= 1) return sorted.length ? 1 : null
          const rank = sorted.findIndex((p) => p >= position)
          return (rank === -1 ? sorted.length - 1 : rank) / (sorted.length - 1)
        }

        const mapped: AssociationDetail[] = allData.map((a: any) => ({
          associationId: a.id,
          candidateId: a.candidate_id,
          jobId: a.job_id,
          jobTitle: a.jobs?.title ?? 'Unknown Job',
          stageName: a.job_hiring_stages?.job_stages?.stage_name ?? null,
          stageLabel: a.job_hiring_stages?.custom_stage_name || a.job_hiring_stages?.job_stages?.stage_name || null,
          stageProgress: progressOf(a.job_id, a.job_hiring_stages?.position),
          pipelineStatus: a.status ?? null,
          enteredStageAt: a.entered_stage_at,
          bookingLinkSentAt: a.booking_link_sent_at,
          rejectedAt: a.rejected_at,
          offeredAt: a.offered_at,
          hiredAt: a.hired_at ?? null,
          createdAt: a.created_at,
          addedBy: a.added_by ?? null,
          isFavorite: a.is_favorite === true,
        }))

        setAssociations(mapped)
      } catch (err) {
        console.error('Error fetching candidate job associations:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAll()
  }, [candidateIds.join(',')])

  const associationsMap = useMemo<AssociationsMap>(() => {
    const map = new Map<string, AssociationDetail[]>()
    for (const a of associations) {
      const list = map.get(a.candidateId) || []
      list.push(a)
      map.set(a.candidateId, list)
    }
    return map
  }, [associations])

  return { associationsMap, associations, isLoading }
}
