import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface IndependentCandidate {
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
  resume_url: string | null
  skills: string[] | null
  auto_generated_skills: any[] | null
  status: string
  source: string
  created_at: string
  updated_at: string
  created_by: string | null
  organization_id: string | null
}

export interface CreateIndependentCandidateData {
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
  resume_url?: string | null
  skills?: string[] | null
  status?: string
  source?: string
  organization_id?: string | null
}

export function useIndependentCandidates() {
  const [candidates, setCandidates] = useState<IndependentCandidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, organizationId } = useAuth()

  const getCandidates = async () => {
    if (!user || !organizationId) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching independent candidates for organization:', organizationId)
      
      const { data, error: fetchError } = await supabase
        .from('candidates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching independent candidates:', fetchError)
        throw fetchError
      }

      console.log('Fetched independent candidates:', data)
      // Type cast the data to fix auto_generated_skills type mismatch
      const typedData = (data || []).map(candidate => ({
        ...candidate,
        auto_generated_skills: (candidate.auto_generated_skills as any) || null
      })) as IndependentCandidate[]
      setCandidates(typedData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch candidates'
      console.error('Independent candidates fetch error:', err)
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

  const addCandidate = async (candidateData: CreateIndependentCandidateData) => {
    if (!user || !organizationId) throw new Error('User not authenticated or no organization context')

    setIsLoading(true)
    setError(null)

    try {
      console.log('Adding independent candidate:', candidateData)
      
      // Check for duplicates within the same organization
      if (candidateData.email || candidateData.candidate_name) {
        const duplicateQuery = candidateData.email 
          ? supabase.from('candidates').select('id', { count: 'exact', head: true })
              .eq('email', candidateData.email)
              .eq('organization_id', organizationId)
          : supabase.from('candidates').select('id', { count: 'exact', head: true })
              .eq('candidate_name', candidateData.candidate_name)
              .eq('organization_id', organizationId)
              .is('email', null)
        
        const { count, error: checkError } = await duplicateQuery

        if (checkError) {
          console.error('Error checking for duplicates:', checkError)
        } else if (count && count > 0) {
          toast({
            title: 'Duplicate Candidate',
            description: `A candidate with this ${candidateData.email ? 'email' : 'name'} already exists.`,
            variant: 'destructive'
          })
          return null
        }
      }

      const { data: newCandidate, error: createError } = await supabase
        .from('candidates')
        .insert([{
          ...candidateData,
          created_by: user.id,
          organization_id: organizationId,
        }])
        .select()
        .single()

      if (createError) {
        console.error('Error adding independent candidate:', createError)
        throw createError
      }

      console.log('Added independent candidate:', newCandidate)
      toast({
        title: 'Success',
        description: 'Candidate added successfully'
      })

      await getCandidates() // Refresh the list
      return newCandidate
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add candidate'
      console.error('Independent candidate creation error:', err)
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

  const updateCandidate = async (id: string, candidateData: Partial<CreateIndependentCandidateData>) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating independent candidate:', id, candidateData)
      const { data: updatedCandidate, error: updateError } = await supabase
        .from('candidates')
        .update(candidateData)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating independent candidate:', updateError)
        throw updateError
      }

      console.log('Updated independent candidate:', updatedCandidate)
      toast({
        title: 'Success',
        description: 'Candidate updated successfully'
      })

      await getCandidates() // Refresh the list
      return updatedCandidate
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update candidate'
      console.error('Independent candidate update error:', err)
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
      console.log('Deleting independent candidate:', id)
      const { error: deleteError } = await supabase
        .from('candidates')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting independent candidate:', deleteError)
        throw deleteError
      }

      console.log('Deleted independent candidate:', id)
      toast({
        title: 'Success',
        description: 'Candidate deleted successfully'
      })

      await getCandidates() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete candidate'
      console.error('Independent candidate deletion error:', err)
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
    if (user && organizationId) {
      getCandidates()
    }
  }, [user, organizationId])

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