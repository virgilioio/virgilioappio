import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface CandidateAssociation {
  id: string
  candidate_id: string
  job_id: string
  notes: string | null
  status: string
  added_by: string | null
  created_at: string
  updated_at: string
  candidate?: {
    id: string
    candidate_name: string
    email: string | null
    phone: string | null
    skills: string[] | null
  }
  job?: {
    id: string
    title: string
    organization: {
      name: string
    }
  }
}

export interface CreateAssociationData {
  candidate_id: string
  job_id: string
  notes?: string | null
  status?: string
}

export function useCandidateAssociations(jobId?: string) {
  const [associations, setAssociations] = useState<CandidateAssociation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getAssociations = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching candidate associations', jobId ? `for job: ${jobId}` : 'for all jobs')
      
      let query = supabase
        .from('job_candidate_associations')
        .select(`
          *,
          candidate:candidates!inner (
            id,
            candidate_name,
            email,
            phone,
            skills
          ),
          job:jobs!inner (
            id,
            title,
            organization:organizations!inner (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (jobId) {
        query = query.eq('job_id', jobId)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Error fetching candidate associations:', fetchError)
        throw fetchError
      }

      console.log('Fetched candidate associations:', data)
      setAssociations(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch candidate associations'
      console.error('Candidate associations fetch error:', err)
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

  const addAssociation = async (associationData: CreateAssociationData) => {
    if (!user) throw new Error('User not authenticated')

    setIsLoading(true)
    setError(null)

    try {
      console.log('Adding candidate association:', associationData)
      
      // Check if association already exists
      const { data: existingAssociation, error: checkError } = await supabase
        .from('job_candidate_associations')
        .select('id')
        .eq('candidate_id', associationData.candidate_id)
        .eq('job_id', associationData.job_id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error checking for existing association:', checkError)
        throw checkError
      }

      if (existingAssociation) {
        toast({
          title: 'Association Exists',
          description: 'This candidate is already associated with this job.',
          variant: 'destructive'
        })
        return existingAssociation
      }

      const { data: newAssociation, error: createError } = await supabase
        .from('job_candidate_associations')
        .insert([{
          ...associationData,
          added_by: user.id,
        }])
        .select()
        .single()

      if (createError) {
        console.error('Error adding candidate association:', createError)
        throw createError
      }

      console.log('Added candidate association:', newAssociation)
      toast({
        title: 'Success',
        description: 'Candidate associated with job successfully'
      })

      await getAssociations() // Refresh the list
      return newAssociation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add candidate association'
      console.error('Candidate association creation error:', err)
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

  const updateAssociation = async (id: string, associationData: Partial<CreateAssociationData>) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating candidate association:', id, associationData)
      const { data: updatedAssociation, error: updateError } = await supabase
        .from('job_candidate_associations')
        .update(associationData)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating candidate association:', updateError)
        throw updateError
      }

      console.log('Updated candidate association:', updatedAssociation)
      toast({
        title: 'Success',
        description: 'Association updated successfully'
      })

      await getAssociations() // Refresh the list
      return updatedAssociation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update association'
      console.error('Candidate association update error:', err)
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

  const deleteAssociation = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Deleting candidate association:', id)
      const { error: deleteError } = await supabase
        .from('job_candidate_associations')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting candidate association:', deleteError)
        throw deleteError
      }

      console.log('Deleted candidate association:', id)
      toast({
        title: 'Success',
        description: 'Association removed successfully'
      })

      await getAssociations() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove association'
      console.error('Candidate association deletion error:', err)
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
    if (user) {
      getAssociations()
    }
  }, [user, jobId])

  return {
    associations,
    isLoading,
    error,
    getAssociations,
    addAssociation,
    updateAssociation,
    deleteAssociation
  }
}