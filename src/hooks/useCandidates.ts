import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useOrgContext } from '@/contexts/OrgContext'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { toast } from '@/hooks/use-toast'
import { log } from '@/lib/logger'
import { checkForDuplicateCandidate, createCandidate, createJobAssociation, mergeCandidate, smartMerge, DuplicateCheckResult } from '@/lib/candidateHelpers'
import { useQueryClient } from '@tanstack/react-query'

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
  // Association-specific fields
  association_id: string | null
  association_notes: string | null
  association_status: string | null
  current_stage_id: string | null
  added_by: string | null
  association_created_at: string | null
  first_viewed_by: Record<string, string> | null
  // Backward compatibility fields (computed from association data)
  notes: string | null // Maps to association_notes
  job_id: string // Required for backward compatibility
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
  // Association-specific data (not stored in candidates table)
  notes?: string | null
  assignedJobId?: string | null
  assignedStageId?: string | null
  job_id?: string | null
}

// Duplicate result interface for UI handling
export interface DuplicateResult {
  isDuplicate: true
  existingCandidate: any
  incomingData: CreateCandidateData
  mergedData: any
  jobId?: string
}

export function useCandidates(jobId: string) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { organizationId } = useOrgContext()
  const queryClient = useQueryClient()

  const getCandidates = async () => {
    if (!user || !jobId) return

    setIsLoading(true)
    setError(null)

    try {
      log.debug('Fetching candidates for job:', jobId)
      
      // Optimized query with 401 retry wrapper
      const { data, error: fetchError } = await withAuthRetry(async () =>
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
              updated_at
            )
          `)
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
      )

      if (fetchError) {
        log.error('Error fetching candidates:', fetchError)
        if (fetchError.message.includes('row-level security')) {
          log.warn('RLS policy blocked access - user may not have permission to view candidates')
          setCandidates([])
          return
        }
        throw fetchError
      }

      log.debug('Optimized fetch completed for', data?.length || 0, 'candidates')
      
      // Optimized transformation with better performance
      const transformedCandidates: Candidate[] = (data || []).map(assoc => {
        const candidate = assoc.candidates as any
        return {
          // Global candidate fields
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
          // Association-specific fields
          association_id: assoc.id,
          association_notes: assoc.notes,
          association_status: assoc.status,
          current_stage_id: assoc.current_stage_id,
          added_by: assoc.added_by,
          association_created_at: assoc.created_at,
          first_viewed_by: null, // Legacy field
          // Backward compatibility fields
          notes: assoc.notes,
          job_id: jobId
        }
      })
      
      setCandidates(transformedCandidates)
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Candidates fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const markCandidateAsViewed = async (candidateId: string) => {
    if (!user) return

    try {
      // Update the global candidate record with view information
      const candidate = candidates.find(c => c.id === candidateId)
      if (!candidate) return

      const currentViews = candidate.first_viewed_by || {}
      
      // If user hasn't viewed this candidate yet, add them
      if (!currentViews[user.id]) {
        const updatedViews = {
          ...currentViews,
          [user.id]: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('candidates')
          .update({ first_viewed_by: updatedViews } as any)
          .eq('id', candidateId)

        if (updateError) {
          log.error('Error marking candidate as viewed:', updateError)
          return
        }

        // Update local state optimistically
        setCandidates(prev => prev.map(c => 
          c.id === candidateId 
            ? { ...c, first_viewed_by: updatedViews }
            : c
        ))
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

    setIsLoading(true)
    setError(null)

    try {
      log.debug('Adding candidate to job:', jobId, candidateData)
      
      // Fetch job data to get organization_id
      const { data: jobData, error: jobError } = await withAuthRetry(async () =>
        await supabase
          .from('jobs')
          .select('id, organization_id, title')
          .eq('id', jobId)
          .single()
      )

      if (jobError || !jobData) {
        log.error('Error verifying job access:', jobError)
        throw new Error('Unable to verify job access. You may not have permission to add candidates to this job.')
      }

      log.debug('Job verification successful:', jobData)
      
      // Verify organization_id is present
      if (!jobData.organization_id) {
        log.error('Job has no organization_id:', jobData)
        throw new Error('Job is not associated with an organization. Please contact support.')
      }
      
      log.debug('Job organization verified:', jobData.organization_id)

      // Check for duplicates using shared helper
      const duplicateCheck = await checkForDuplicateCandidate(candidateData, jobData.organization_id)
      
      if (duplicateCheck) {
        // Return duplicate info for UI to handle - don't merge automatically
        return {
          isDuplicate: true,
          existingCandidate: duplicateCheck.existingCandidate,
          incomingData: candidateData,
          mergedData: duplicateCheck.mergedData,
          jobId: jobId
        } as DuplicateResult
      }

      // No duplicate - create new candidate using shared helper
      // Strip form-only fields that don't exist in candidates table
      const { assignedJobId, assignedStageId, job_id, notes, ...cleanCandidateData } = candidateData as any

      const newCandidate = await createCandidate({
        ...cleanCandidateData,
        candidate_name: candidateData.candidate_name,
        organization_id: jobData.organization_id,
        created_by: user.id,
        status: 'available',
        source: 'direct'
      })

      // Create the job association using shared helper
      await createJobAssociation(
        jobId,
        newCandidate.id,
        candidateData.notes,
        candidateData.assignedStageId,
        'active',
        user.id
      )

      toast({
        title: 'Success',
        description: 'Candidate added. You can attach a resume from the candidate panel.',
      })

      await getCandidates()
      
      // Recompute onboarding progress
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id) {
          const { data: member } = await supabase
            .from('members')
            .select('tenant_id')
            .eq('user_id', authUser.id)
            .eq('user_status', 'active')
            .single();

          if (member?.tenant_id) {
            await supabase.rpc('check_onboarding_task_completion', {
              p_user_id: authUser.id,
              p_tenant_id: member.tenant_id
            });
            queryClient.invalidateQueries({ 
              queryKey: ['onboarding-progress', authUser.id, member.tenant_id] 
            });
          }
        }
      } catch (error) {
        console.error('Failed to update onboarding progress:', error);
      }
      
      return {
        id: newCandidate.id,
        wasMerged: false,
        existingData: null,
        mergedData: null
      }
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Candidate creation error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Confirm and process a duplicate candidate merge after user approval
   */
  const confirmMergeCandidate = async (
    existingCandidateId: string,
    candidateData: CreateCandidateData,
    stageId?: string | null
  ): Promise<any> => {
    if (!user || !jobId) throw new Error('User not authenticated or job ID missing')

    setIsLoading(true)
    setError(null)

    try {
      // Strip form-only fields before merge
      const { assignedJobId, assignedStageId, job_id, notes, ...cleanData } = candidateData as any
      
      await mergeCandidate(existingCandidateId, cleanData)
      
      await createJobAssociation(
        jobId,
        existingCandidateId,
        candidateData.notes,
        stageId,
        'active',
        user.id
      )

      toast({
        title: 'Success',
        description: 'Candidate merged and added to job',
      })

      await getCandidates()
      
      // Recompute onboarding progress
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser?.id) {
          const { data: member } = await supabase
            .from('members')
            .select('tenant_id')
            .eq('user_id', authUser.id)
            .eq('user_status', 'active')
            .single()

          if (member?.tenant_id) {
            await supabase.rpc('check_onboarding_task_completion', {
              p_user_id: authUser.id,
              p_tenant_id: member.tenant_id
            })
            queryClient.invalidateQueries({ 
              queryKey: ['onboarding-progress', authUser.id, member.tenant_id] 
            })
          }
        }
      } catch (error) {
        console.error('Failed to update onboarding progress:', error)
      }

      return { id: existingCandidateId, wasMerged: true }
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Candidate merge error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateCandidate = async (id: string, candidateData: Partial<CreateCandidateData>) => {
    setIsLoading(true)
    setError(null)

    try {
      log.debug('Updating global candidate:', id, candidateData)
      
      // Update the global candidate record (exclude notes as it belongs to association, not candidates table)
      const { notes, ...globalCandidateData } = candidateData
      
      // Filter out any fields that don't belong in the candidates table
      const allowedCandidateFields = {
        candidate_name: globalCandidateData.candidate_name,
        email: globalCandidateData.email,
        phone: globalCandidateData.phone,
        // Sync contact arrays with primary values (text[] columns require JSON strings)
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
      
      // Remove undefined values
      const filteredCandidateData = Object.fromEntries(
        Object.entries(allowedCandidateFields).filter(([_, value]) => value !== undefined)
      )
      const { data: updatedCandidate, error: updateError } = await supabase
        .from('candidates')
        .update(filteredCandidateData)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        log.error('Error updating global candidate:', updateError)
        throw updateError
      }

      // Update association notes if provided
      if (notes !== undefined) {
        const candidate = candidates.find(c => c.id === id)
        if (candidate && candidate.association_id) {
          await supabase
            .from('job_candidate_associations')
            .update({ notes })
            .eq('id', candidate.association_id)
        }
      }

      log.debug('Updated candidate:', updatedCandidate)
      toast({
        title: 'Success',
        description: 'Candidate updated successfully'
      })

      await getCandidates() // Refresh the list
      return updatedCandidate
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Candidate update error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const deleteCandidate = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      log.debug('Removing candidate from job:', id)
      
      // Find the association for this candidate and job
      const candidate = candidates.find(c => c.id === id)
      if (candidate && candidate.association_id) {
        const { error: deleteError } = await supabase
          .from('job_candidate_associations')
          .delete()
          .eq('id', candidate.association_id)

        if (deleteError) {
          log.error('Error removing candidate association:', deleteError)
          throw deleteError
        }
      }

      log.debug('Removed candidate from job:', id)
      toast({
        title: 'Success',
        description: 'Candidate removed from job successfully'
      })

      await getCandidates() // Refresh the list
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Candidate deletion error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user && jobId) {
      getCandidates()
    }
  }, [user, jobId])

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
