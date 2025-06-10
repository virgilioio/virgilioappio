
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Candidate {
  id: string
  job_id: string
  candidate_name: string
  candidate_email: string
  notes: string | null
  resume_url: string | null
  added_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateCandidateData {
  job_id: string
  candidate_name: string
  candidate_email: string
  notes?: string | null
  resume_url?: string | null
}

export interface UpdateCandidateData {
  candidate_name?: string
  candidate_email?: string
  notes?: string | null
  resume_url?: string | null
}

export function useCandidates(jobId?: string) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getCandidates = async (targetJobId?: string) => {
    const queryJobId = targetJobId || jobId
    if (!user || !queryJobId) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching candidates for job:', queryJobId)
      const { data, error: fetchError } = await supabase
        .from('job_candidates')
        .select('*')
        .eq('job_id', queryJobId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching candidates:', fetchError)
        throw fetchError
      }

      console.log('Fetched candidates:', data)
      setCandidates(data || [])
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

  const addCandidate = async (data: CreateCandidateData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Adding candidate:', data)
      const candidateData = {
        ...data,
        added_by: user?.id
      }

      const { data: newCandidate, error: createError } = await supabase
        .from('job_candidates')
        .insert([candidateData])
        .select()
        .single()

      if (createError) {
        console.error('Error creating candidate:', createError)
        throw createError
      }

      console.log('Created candidate:', newCandidate)
      toast({
        title: 'Success',
        description: 'Candidate added successfully'
      })

      await getCandidates(data.job_id)
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

  const updateCandidate = async (candidateId: string, data: UpdateCandidateData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating candidate:', candidateId, data)
      const { data: updatedCandidate, error: updateError } = await supabase
        .from('job_candidates')
        .update(data)
        .eq('id', candidateId)
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

      await getCandidates()
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

  const deleteCandidate = async (candidateId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Deleting candidate:', candidateId)
      const { error: deleteError } = await supabase
        .from('job_candidates')
        .delete()
        .eq('id', candidateId)

      if (deleteError) {
        console.error('Error deleting candidate:', deleteError)
        throw deleteError
      }

      console.log('Deleted candidate:', candidateId)
      toast({
        title: 'Success',
        description: 'Candidate deleted successfully'
      })

      await getCandidates()
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
    deleteCandidate
  }
}
