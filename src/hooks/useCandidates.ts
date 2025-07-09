import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Candidate {
  id: string
  job_id: string
  candidate_name: string
  location_country: string | null
  location_state: string | null
  location_city: string | null
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
  profile_summary: string | null
  notes: string | null
  linkedin_url: string | null
  skills: string[] | null
  added_by: string | null
  created_at: string
  updated_at: string
  first_viewed_by: Record<string, string> | null
}

export interface CreateCandidateData {
  candidate_name: string
  location_country?: string | null
  location_state?: string | null
  location_city?: string | null
  salary_amount?: number | null
  salary_currency?: string | null
  salary_period?: string | null
  profile_summary?: string | null
  notes?: string | null
  linkedin_url?: string | null
  skills?: string[] | null
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
      console.log('Fetching candidates for job:', jobId)
      
      // With RLS enabled, the query will automatically filter by organization through job relationship
      const { data, error: fetchError } = await supabase
        .from('job_candidates')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching candidates:', fetchError)
        // Handle RLS-related errors gracefully
        if (fetchError.message.includes('row-level security')) {
          console.warn('RLS policy blocked access - user may not have permission to view candidates')
          setCandidates([])
          return
        }
        throw fetchError
      }

      console.log('Fetched candidates:', data)
      
      // Transform the data to ensure proper typing
      const transformedCandidates: Candidate[] = (data || []).map(candidate => ({
        ...candidate,
        first_viewed_by: candidate.first_viewed_by as Record<string, string> | null
      }))
      
      setCandidates(transformedCandidates)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch candidates'
      console.error('Candidates fetch error:', err)
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
      // First get the current first_viewed_by data
      const { data: candidate, error: fetchError } = await supabase
        .from('job_candidates')
        .select('first_viewed_by')
        .eq('id', candidateId)
        .single()

      if (fetchError) {
        console.error('Error fetching candidate for view update:', fetchError)
        return
      }

      const currentViews = (candidate?.first_viewed_by as Record<string, string>) || {}
      
      // If user hasn't viewed this candidate yet, add them
      if (!currentViews[user.id]) {
        const updatedViews = {
          ...currentViews,
          [user.id]: new Date().toISOString()
        }

        const { error: updateError } = await supabase
          .from('job_candidates')
          .update({ first_viewed_by: updatedViews })
          .eq('id', candidateId)

        if (updateError) {
          console.error('Error marking candidate as viewed:', updateError)
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
      console.error('Error in markCandidateAsViewed:', err)
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
        console.error('Error verifying job access:', jobError)
        throw new Error('Unable to verify job access. You may not have permission to add candidates to this job.')
      }

      if (!jobData) {
        throw new Error('Job not found or you do not have access to this job.')
      }

      console.log('Job verification successful:', jobData)

      // Step 1: Check if candidate already exists in independent candidates table
      let independentCandidateId: string | null = null
      
      if (candidateData.candidate_name) {
        const { data: existingCandidate } = await supabase
          .from('candidates')
          .select('id')
          .eq('candidate_name', candidateData.candidate_name)
          .eq('location_country', candidateData.location_country || null)
          .eq('location_city', candidateData.location_city || null)
          .maybeSingle()
        
        independentCandidateId = existingCandidate?.id || null
      }

      // Step 2: If not exists, create in independent candidates table
      if (!independentCandidateId) {
        const { data: newIndependentCandidate, error: independentError } = await supabase
          .from('candidates')
          .insert([{
            candidate_name: candidateData.candidate_name,
            location_country: candidateData.location_country,
            location_state: candidateData.location_state,
            location_city: candidateData.location_city,
            salary_amount: candidateData.salary_amount,
            salary_currency: candidateData.salary_currency,
            salary_period: candidateData.salary_period,
            profile_summary: candidateData.profile_summary,
            linkedin_url: candidateData.linkedin_url,
            skills: candidateData.skills,
            status: 'available',
            source: 'job_application',
            created_by: user.id,
          }])
          .select('id')
          .single()

        if (!independentError && newIndependentCandidate) {
          independentCandidateId = newIndependentCandidate.id
          console.log('Created independent candidate:', independentCandidateId)
        }
      }

      // Step 3: Create job candidate (original functionality)
      const { data: newCandidate, error: createError } = await supabase
        .from('job_candidates')
        .insert([{
          ...candidateData,
          job_id: jobId,
          added_by: user.id,
        }])
        .select()
        .single()

      if (createError) {
        console.error('Error adding candidate:', createError)
        
        // Provide more specific error messages based on the error type
        if (createError.message.includes('row-level security')) {
          throw new Error('You do not have permission to add candidates to this job. Please contact your administrator.')
        } else if (createError.message.includes('foreign key')) {
          throw new Error('Invalid job reference. Please refresh the page and try again.')
        } else {
          throw createError
        }
      }

      // Step 4: Create association between job candidate and independent candidate
      if (independentCandidateId && newCandidate) {
        await supabase
          .from('job_candidate_associations')
          .insert([{
            job_id: jobId,
            candidate_id: independentCandidateId,
            notes: candidateData.notes,
            added_by: user.id,
          }])
      }

      console.log('Added candidate:', newCandidate)
      toast({
        title: 'Success',
        description: 'Candidate added successfully'
      })

      await getCandidates() // Refresh the list
      return newCandidate
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add candidate'
      console.error('Candidate creation error:', err)
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
      console.log('Updating candidate:', id, candidateData)
      const { data: updatedCandidate, error: updateError } = await supabase
        .from('job_candidates')
        .update(candidateData)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating candidate:', updateError)
        throw updateError
      }

      console.log('Updated candidate:', updatedCandidate)
      toast({
        title: 'Success',
        description: 'Candidate updated successfully'
      })

      await getCandidates() // Refresh the list
      return updatedCandidate
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update candidate'
      console.error('Candidate update error:', err)
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
      console.log('Deleting candidate:', id)
      const { error: deleteError } = await supabase
        .from('job_candidates')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting candidate:', deleteError)
        throw deleteError
      }

      console.log('Deleted candidate:', id)
      toast({
        title: 'Success',
        description: 'Candidate deleted successfully'
      })

      await getCandidates() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete candidate'
      console.error('Candidate deletion error:', err)
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
