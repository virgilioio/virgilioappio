import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { toast } from '@/hooks/use-toast'
import { log } from '@/lib/logger'

export interface Candidate {
  id: string
  candidate_name: string
  email: string | null
  phone: string | null
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
  // Association-specific data
  notes?: string | null
}

export function useCandidates(jobId: string) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

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

  const addCandidate = async (candidateData: CreateCandidateData) => {
    if (!user || !jobId) throw new Error('User not authenticated or job ID missing')

    setIsLoading(true)
    setError(null)

    try {
      console.log('Adding candidate to job:', jobId, candidateData)
      
      // First, verify the user has access to this job by trying to fetch it
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, organization_id, title')
        .eq('id', jobId)
        .single()

      if (jobError) {
        log.error('Error verifying job access:', jobError)
        throw new Error('Unable to verify job access. You may not have permission to add candidates to this job.')
      }

      if (!jobData) {
        throw new Error('Job not found or you do not have access to this job.')
      }

      log.debug('Job verification successful:', jobData)

      // Step 1: Check if candidate already exists in global candidates table
      let globalCandidateId: string | null = null
      
      if (candidateData.candidate_name) {
        let q = supabase
          .from('candidates')
          .select('id')
          .eq('candidate_name', candidateData.candidate_name)
        if (candidateData.location_country === null || candidateData.location_country === undefined) {
          q = q.is('location_country', null)
        } else {
          q = q.eq('location_country', candidateData.location_country)
        }
        if (candidateData.location_city === null || candidateData.location_city === undefined) {
          q = q.is('location_city', null)
        } else {
          q = q.eq('location_city', candidateData.location_city)
        }
        const { data: existingCandidate } = await q.maybeSingle()
        
        globalCandidateId = existingCandidate?.id || null
      }

      // Step 2: If not exists, create in global candidates table
      if (!globalCandidateId) {
        const { notes, ...globalCandidateData } = candidateData
        const { data: newGlobalCandidate, error: globalError } = await supabase
          .from('candidates')
          .insert([{
            ...globalCandidateData,
            status: 'available',
            source: 'job_application',
            created_by: user.id,
          }])
          .select('id')
          .single()

        if (!globalError && newGlobalCandidate) {
          globalCandidateId = newGlobalCandidate.id
          log.debug('Created global candidate:', globalCandidateId)
        } else {
          log.error('Error creating global candidate:', globalError)
          throw globalError || new Error('Failed to create global candidate')
        }
      } else {
        // If exists, update the global candidate record with any new data
        const updateData: any = {}
        if (candidateData.email) updateData.email = candidateData.email
        if (candidateData.phone) updateData.phone = candidateData.phone
        if (candidateData.profile_summary) updateData.profile_summary = candidateData.profile_summary
        if (candidateData.linkedin_url) updateData.linkedin_url = candidateData.linkedin_url
        if (candidateData.skills) updateData.skills = candidateData.skills

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('candidates')
            .update(updateData)
            .eq('id', globalCandidateId)
        }
      }

      // Step 3: Create association between job and global candidate
      const { data: newAssociation, error: assocError } = await supabase
        .from('job_candidate_associations')
        .insert([{
          job_id: jobId,
          candidate_id: globalCandidateId,
          current_stage_id: null, // Application Review
          status: 'active',
          notes: candidateData.notes,
          added_by: user.id,
        }])
        .select()
        .single()

      if (assocError) {
        log.error('Error creating association:', assocError)
        
        // Provide more specific error messages based on the error type
        if (assocError.message.includes('row-level security')) {
          throw new Error('You do not have permission to add candidates to this job. Please contact your administrator.')
        } else if (assocError.message.includes('foreign key')) {
          throw new Error('Invalid job reference. Please refresh the page and try again.')
        } else {
          throw assocError
        }
      }

      log.debug('Added candidate association:', newAssociation)
      toast({
        title: 'Success',
        description: 'Candidate added. You can attach a resume from the candidate panel.',
      })

      await getCandidates() // Refresh the list
      return newAssociation
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
    updateCandidate,
    deleteCandidate,
    markCandidateAsViewed,
    isCandidateNewForUser
  }
}
