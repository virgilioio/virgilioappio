import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface AssociationDetail {
  associationId: string
  candidateId: string
  jobId: string
  jobTitle: string
  stageName: string | null
  pipelineStatus: string | null
  enteredStageAt: string | null
  bookingLinkSentAt: string | null
  rejectedAt: string | null
  offeredAt: string | null
  createdAt: string
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
              created_at,
              jobs!inner(id, title),
              job_hiring_stages!job_candidate_associations_current_stage_id_fkey(
                id,
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

        const mapped: AssociationDetail[] = allData.map((a: any) => ({
          associationId: a.id,
          candidateId: a.candidate_id,
          jobId: a.job_id,
          jobTitle: a.jobs?.title ?? 'Unknown Job',
          stageName: a.job_hiring_stages?.job_stages?.stage_name ?? null,
          pipelineStatus: a.status ?? null,
          enteredStageAt: a.entered_stage_at,
          bookingLinkSentAt: a.booking_link_sent_at,
          rejectedAt: a.rejected_at,
          offeredAt: a.offered_at,
          createdAt: a.created_at,
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
