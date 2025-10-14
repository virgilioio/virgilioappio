import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'

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
      log.debug('Fetching independent candidates for organization:', organizationId)
      
      const { data, error: fetchError } = await withAuthRetry(async () =>
        await supabase
          .from('candidates')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
      )

      if (fetchError) {
        log.error('Error fetching independent candidates:', fetchError)
        throw fetchError
      }

      log.debug('Fetched independent candidates:', data)
      // Type cast the data to fix auto_generated_skills type mismatch
      const typedData = (data || []).map(candidate => ({
        ...candidate,
        auto_generated_skills: (candidate.auto_generated_skills as any) || null
      })) as IndependentCandidate[]
      setCandidates(typedData)
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Independent candidates fetch error:', err)
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
      log.debug('Adding independent candidate:', candidateData)
      
      // Check for duplicates within the same organization
      if (candidateData.email || candidateData.candidate_name) {
        const duplicateQuery = candidateData.email 
          ? async () => await supabase.from('candidates').select('id', { count: 'exact', head: true })
              .eq('email', candidateData.email!)
              .eq('organization_id', organizationId)
          : async () => await supabase.from('candidates').select('id', { count: 'exact', head: true })
              .eq('candidate_name', candidateData.candidate_name)
              .eq('organization_id', organizationId)
              .is('email', null)
        
        const result = await withAuthRetry(duplicateQuery)
        const count = (result as any).count

        if (result.error) {
          log.error('Error checking for duplicates:', result.error)
        } else if (count && count > 0) {
          toast({
            title: 'Duplicate Candidate',
            description: `A candidate with this ${candidateData.email ? 'email' : 'name'} already exists.`,
            variant: 'destructive'
          })
          return null
        }
      }

      // Explicitly map only valid database fields to prevent schema errors
      const { data: newCandidate, error: createError } = await withAuthRetry(async () =>
        await supabase
          .from('candidates')
          .insert([{
            candidate_name: candidateData.candidate_name,
            email: candidateData.email,
            phone: candidateData.phone,
            location_country: candidateData.location_country,
            location_state: candidateData.location_state,
            location_city: candidateData.location_city,
            salary_amount: candidateData.salary_amount,
            salary_currency: candidateData.salary_currency,
            salary_period: candidateData.salary_period,
            profile_summary: candidateData.profile_summary,
            linkedin_url: candidateData.linkedin_url,
            resume_url: candidateData.resume_url,
            skills: candidateData.skills,
            status: candidateData.status || 'available',
            source: candidateData.source || 'direct',
            created_by: user.id,
            organization_id: organizationId,
          }])
          .select()
          .single()
      )

      if (createError) {
        log.error('Error adding independent candidate:', createError)
        throw createError
      }

      log.debug('Added independent candidate:', newCandidate)
      toast({
        title: 'Success',
        description: 'Candidate added successfully'
      })

      await getCandidates() // Refresh the list
      return newCandidate
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Independent candidate creation error:', err)
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
      log.debug('Updating independent candidate:', id, candidateData)
      
      // Explicitly map only valid database fields to prevent schema errors
      const updateData: Record<string, any> = {}
      if (candidateData.candidate_name !== undefined) updateData.candidate_name = candidateData.candidate_name
      if (candidateData.email !== undefined) updateData.email = candidateData.email
      if (candidateData.phone !== undefined) updateData.phone = candidateData.phone
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

      const { data: updatedCandidate, error: updateError } = await withAuthRetry(async () =>
        await supabase
          .from('candidates')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
      )

      if (updateError) {
        log.error('Error updating independent candidate:', updateError)
        throw updateError
      }

      log.debug('Updated independent candidate:', updatedCandidate)
      toast({
        title: 'Success',
        description: 'Candidate updated successfully'
      })

      await getCandidates() // Refresh the list
      return updatedCandidate
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Independent candidate update error:', err)
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
      log.debug('Deleting independent candidate:', id)
      const { error: deleteError } = await withAuthRetry(async () =>
        await supabase
          .from('candidates')
          .delete()
          .eq('id', id)
      )

      if (deleteError) {
        log.error('Error deleting independent candidate:', deleteError)
        throw deleteError
      }

      log.debug('Deleted independent candidate:', id)
      toast({
        title: 'Success',
        description: 'Candidate deleted successfully'
      })

      await getCandidates() // Refresh the list
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Independent candidate deletion error:', err)
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