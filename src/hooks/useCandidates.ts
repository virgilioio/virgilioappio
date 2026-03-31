import { useState, useCallback } from 'react'
import { refreshOnboardingProgress } from '@/utils/refreshOnboardingProgress'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useOrgContext } from '@/contexts/OrgContext'
import { useTenant } from '@/hooks/useTenant'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { toast } from '@/hooks/use-toast'
import { log } from '@/lib/logger'
import { checkForDuplicateCandidate, createCandidate, createJobAssociation, mergeCandidate, smartMerge, DuplicateCheckResult } from '@/lib/candidateHelpers'
import { useQueryClient, useQuery } from '@tanstack/react-query'

export interface ContactPhone {
  type: 'work' | 'mobile' | 'other'
  number: string
  raw_number?: string | null
}

export interface ContactEmail {
  type: 'work' | 'personal' | 'other'
  email: string
  status?: string | null
}

export interface Candidate {
  id: string
  candidate_name: string
  email: string | null
  phone: string | null
  contact_phones?: ContactPhone[] | any[] | null
  contact_emails?: ContactEmail[] | any[] | null
  location_country: string | null
  location_state: string | null
  location_city: string | null
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
  profile_summary: string | null
  linkedin_url: string | null
  skills: string[] | null
  auto_generated_skills: any[] | null
  created_at: string
  updated_at: string
  association_id: string | null
  association_notes: string | null
  association_status: string | null
  current_stage_id: string | null
  added_by: string | null
  association_created_at: string | null
  first_viewed_by: Record<string, string> | null
  notes: string | null
  job_id: string
  source: string | null
}

export interface CreateCandidateData {
  candidate_name: string
  email?: string | null
  phone?: string | null
  location_country?: string | null
  location_state?: string | null
  location_city?: string | null
  salary_amount?: number | null
  salary_currency?: string | null
  salary_period?: string | null
  profile_summary?: string | null
  linkedin_url?: string | null
  skills?: string[] | null
  notes?: string | null
  assignedJobId?: string | null
  assignedStageId?: string | null
  job_id?: string | null
}

export interface DuplicateResult {
  isDuplicate: true
  existingCandidate: any
  incomingData: CreateCandidateData
  mergedData: any
  jobId?: string
}

async function fetchJobCandidates(jobId: string): Promise<Candidate[]> {
  const { data, error } = await withAuthRetry(async () =>
    await supabase
      .from('job_candidate_associations')
      .select(`
        id,
        notes,
        status,
        current_stage_id,
        added_by,
        created_at,
        candidates!inner (
          id,
          candidate_name,
          email,
          phone,
          location_country,
          location_state,
          location_city,
          salary_amount,
          salary_currency,
          salary_period,
          profile_summary,
          linkedin_url,
          skills,
          auto_generated_skills,
          created_at,
          updated_at,
          source
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
  )

  if (error) {
    if (error.message.includes('row-level security')) {
      log.warn('RLS policy blocked access')
      return []
    }
    throw error
  }

  return (data || []).map(assoc => {
    const candidate = assoc.candidates as any
    return {
      id: candidate.id,
      candidate_name: candidate.candidate_name,
      email: candidate.email,
      phone: candidate.phone,
      location_country: candidate.location_country,
      location_state: candidate.location_state,
      location_city: candidate.location_city,
      salary_amount: candidate.salary_amount,
      salary_currency: candidate.salary_currency,
      salary_period: candidate.salary_period,
      profile_summary: candidate.profile_summary,
      linkedin_url: candidate.linkedin_url,
      skills: candidate.skills,
      auto_generated_skills: candidate.auto_generated_skills,
      created_at: candidate.created_at,
      updated_at: candidate.updated_at,
      association_id: assoc.id,
      association_notes: assoc.notes,
      association_status: assoc.status,
      current_stage_id: assoc.current_stage_id,
      added_by: assoc.added_by,
      association_created_at: assoc.created_at,
      first_viewed_by: null,
      notes: assoc.notes,
      job_id: jobId,
      source: candidate.source || null
    } as Candidate
  })
}

export function useCandidates(jobId: string) {
  const { user } = useAuth()
  const { organizationId } = useOrgContext()
  const { tenant } = useTenant()
  const queryClient = useQueryClient()

  const queryKey = ['job-candidates', jobId] as const

  const { data: candidates = [], isLoading, error: queryError } = useQuery({
    queryKey,
    queryFn: () => fetchJobCandidates(jobId),
    enabled: !!user && !!jobId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch candidates') : null

  // Backward-compat refresh
  const getCandidates = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['job-candidates', jobId] })
  }, [queryClient, jobId])

  const markCandidateAsViewed = async (candidateId: string) => {
    if (!user) return
    try {
      const candidate = candidates.find(c => c.id === candidateId)
      if (!candidate) return
      const currentViews = candidate.first_viewed_by || {}
      if (!currentViews[user.id]) {
        const updatedViews = { ...currentViews, [user.id]: new Date().toISOString() }
        await supabase
          .from('candidates')
          .update({ first_viewed_by: updatedViews } as any)
          .eq('id', candidateId)
        // Optimistic update via invalidation
        queryClient.invalidateQueries({ queryKey: ['job-candidates', jobId] })
      }
    } catch (err) {
      log.error('Error in markCandidateAsViewed:', err)
    }
  }

  const isCandidateNewForUser = (candidate: Candidate): boolean => {
    if (!user || !candidate.first_viewed_by) return true
    return !candidate.first_viewed_by[user.id]
  }

  const addCandidate = async (candidateData: CreateCandidateData): Promise<Candidate | DuplicateResult | any> => {
    if (!user || !jobId) throw new Error('User not authenticated or job ID missing')

    try {
      const { data: jobData, error: jobError } = await withAuthRetry(async () =>
        await supabase.from('jobs').select('id, organization_id, title').eq('id', jobId).single()
      )

      if (jobError || !jobData) throw new Error('Unable to verify job access.')
      if (!jobData.organization_id) throw new Error('Job is not associated with an organization.')

      const duplicateCheck = await checkForDuplicateCandidate(candidateData, jobData.organization_id, tenant?.id)

      if (duplicateCheck) {
        return {
          isDuplicate: true,
          existingCandidate: duplicateCheck.existingCandidate,
          incomingData: candidateData,
          mergedData: duplicateCheck.mergedData,
          jobId
        } as DuplicateResult
      }

      const { assignedJobId, assignedStageId, job_id, notes, ...cleanCandidateData } = candidateData as any

      const newCandidate = await createCandidate({
        ...cleanCandidateData,
        candidate_name: candidateData.candidate_name,
        organization_id: jobData.organization_id,
        created_by: user.id,
        status: 'active',
        source: 'direct'
      })

      await createJobAssociation(jobId, newCandidate.id, candidateData.notes, candidateData.assignedStageId, 'active', user.id)

      toast({ title: 'Success', description: 'Candidate added. You can attach a resume from the candidate panel.' })

      queryClient.invalidateQueries({ queryKey: ['job-candidates', jobId] })
      refreshOnboardingProgress(queryClient, user?.id, tenant?.id)

      return { id: newCandidate.id, wasMerged: false, existingData: null, mergedData: null }
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  const confirmMergeCandidate = async (
    existingCandidateId: string,
    candidateData: CreateCandidateData,
    stageId?: string | null
  ): Promise<any> => {
    if (!user || !jobId) throw new Error('User not authenticated or job ID missing')

    try {
      const { assignedJobId, assignedStageId, job_id, notes, ...cleanData } = candidateData as any
      await mergeCandidate(existingCandidateId, cleanData)
      await createJobAssociation(jobId, existingCandidateId, candidateData.notes, stageId, 'active', user.id)

      toast({ title: 'Success', description: 'Candidate merged and added to job' })

      queryClient.invalidateQueries({ queryKey: ['job-candidates', jobId] })
      refreshOnboardingProgress(queryClient, user?.id, tenant?.id)

      return { id: existingCandidateId, wasMerged: true }
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  const updateCandidate = async (id: string, candidateData: Partial<CreateCandidateData>) => {
    try {
      const { notes, ...globalCandidateData } = candidateData

      const allowedCandidateFields = {
        candidate_name: globalCandidateData.candidate_name,
        email: globalCandidateData.email,
        phone: globalCandidateData.phone,
        contact_emails: globalCandidateData.email
          ? [JSON.stringify({ type: 'work', email: globalCandidateData.email, status: 'verified' })]
          : [],
        contact_phones: globalCandidateData.phone
          ? [JSON.stringify({ type: 'other', number: globalCandidateData.phone, raw_number: globalCandidateData.phone })]
          : [],
        location_country: globalCandidateData.location_country,
        location_state: globalCandidateData.location_state,
        location_city: globalCandidateData.location_city,
        salary_amount: globalCandidateData.salary_amount,
        salary_currency: globalCandidateData.salary_currency,
        salary_period: globalCandidateData.salary_period,
        profile_summary: globalCandidateData.profile_summary,
        linkedin_url: globalCandidateData.linkedin_url,
        skills: globalCandidateData.skills
      }

      const filteredCandidateData = Object.fromEntries(
        Object.entries(allowedCandidateFields).filter(([_, value]) => value !== undefined)
      )

      const { data: updatedCandidate, error: updateError } = await supabase
        .from('candidates')
        .update(filteredCandidateData)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      if (notes !== undefined) {
        const candidate = candidates.find(c => c.id === id)
        if (candidate?.association_id) {
          await supabase.from('job_candidate_associations').update({ notes }).eq('id', candidate.association_id)
        }
      }

      toast({ title: 'Success', description: 'Candidate updated successfully' })
      queryClient.invalidateQueries({ queryKey: ['job-candidates', jobId] })
      return updatedCandidate
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  const deleteCandidate = async (id: string) => {
    try {
      const candidate = candidates.find(c => c.id === id)
      if (candidate?.association_id) {
        const { error: deleteError } = await supabase
          .from('job_candidate_associations')
          .delete()
          .eq('id', candidate.association_id)
        if (deleteError) throw deleteError
      }

      toast({ title: 'Success', description: 'Candidate removed from job successfully' })
      queryClient.invalidateQueries({ queryKey: ['job-candidates', jobId] })
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  return {
    candidates,
    isLoading,
    error,
    getCandidates,
    addCandidate,
    confirmMergeCandidate,
    updateCandidate,
    deleteCandidate,
    markCandidateAsViewed,
    isCandidateNewForUser
  }
}
