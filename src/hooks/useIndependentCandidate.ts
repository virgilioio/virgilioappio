import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'
import type { IndependentCandidate, CreateIndependentCandidateData } from './useIndependentCandidates'

const CANDIDATE_COLUMNS =
  'id,candidate_name,email,phone,contact_phones,contact_emails,location_country,location_state,location_city,salary_amount,salary_currency,salary_period,profile_summary,linkedin_url,resume_url,skills,standardized_skills,auto_generated_skills,status,source,created_at,updated_at,created_by,organization_id,seniority_level,functional_area,specialization,standardized_title,years_experience,enrichment_status,current_job_title,company_current'

async function fetchIndependentCandidate(candidateId: string): Promise<IndependentCandidate | null> {
  const { data, error } = await withAuthRetry(async () =>
    await supabase
      .from('candidates')
      .select(CANDIDATE_COLUMNS)
      .eq('id', candidateId)
      .is('deleted_at', null)
      .maybeSingle()
  )

  if (error) throw error
  if (!data) return null

  return {
    ...(data as any),
    auto_generated_skills: (data as any).auto_generated_skills || null,
  } as IndependentCandidate
}

/**
 * Resolves a single candidate directly by id (no list download, no row cap).
 * Returns the same shape the profile page consumes from useIndependentCandidates.
 */
export function useIndependentCandidate(candidateId: string | null | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const {
    data: candidate = null,
    isLoading,
    isFetched,
    error: queryError,
  } = useQuery({
    queryKey: ['independent-candidate', candidateId],
    queryFn: () => fetchIndependentCandidate(candidateId!),
    enabled: !!user && !!candidateId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to fetch candidate'
    : null

  const updateCandidate = useCallback(
    async (id: string, candidateData: Partial<CreateIndependentCandidateData>) => {
      try {
        const updateData: Record<string, any> = {}
        if (candidateData.candidate_name !== undefined) updateData.candidate_name = candidateData.candidate_name
        if (candidateData.email !== undefined) updateData.email = candidateData.email
        if (candidateData.phone !== undefined) updateData.phone = candidateData.phone
        if (candidateData.contact_emails !== undefined) updateData.contact_emails = candidateData.contact_emails?.map(e => JSON.stringify(e)) || []
        if (candidateData.contact_phones !== undefined) updateData.contact_phones = candidateData.contact_phones?.map(p => JSON.stringify(p)) || []
        if (candidateData.location_country !== undefined) updateData.location_country = candidateData.location_country
        if (candidateData.location_state !== undefined) updateData.location_state = candidateData.location_state
        if (candidateData.location_city !== undefined) updateData.location_city = candidateData.location_city
        if (candidateData.salary_amount !== undefined) updateData.salary_amount = candidateData.salary_amount
        if (candidateData.salary_currency !== undefined) updateData.salary_currency = candidateData.salary_currency
        if (candidateData.salary_period !== undefined) updateData.salary_period = candidateData.salary_period
        if (candidateData.profile_summary !== undefined) updateData.profile_summary = candidateData.profile_summary
        if (candidateData.linkedin_url !== undefined) updateData.linkedin_url = candidateData.linkedin_url
        if (candidateData.resume_url !== undefined) updateData.resume_url = candidateData.resume_url
        if (candidateData.skills !== undefined) updateData.skills = candidateData.skills
        if (candidateData.status !== undefined) updateData.status = candidateData.status
        if (candidateData.source !== undefined) updateData.source = candidateData.source
        const nextTitle = candidateData.current_job_title ?? candidateData.current_role
        if (nextTitle !== undefined) updateData.current_job_title = nextTitle || null
        const nextCompany = candidateData.company_current ?? candidateData.current_company
        if (nextCompany !== undefined) updateData.company_current = nextCompany || null

        const { data: updatedCandidate, error: updateError } = await withAuthRetry(async () =>
          await supabase
            .from('candidates')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()
        )

        if (updateError) throw updateError

        toast({ title: 'Success', description: 'Candidate updated successfully' })
        queryClient.invalidateQueries({ queryKey: ['independent-candidate', id] })
        queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
        return updatedCandidate
      } catch (err) {
        const errorMessage = extractErrorMessage(err)
        log.error('Independent candidate update error:', err)
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
        throw err
      }
    },
    [queryClient]
  )

  return { candidate, isLoading, isFetched, error, updateCandidate }
}
