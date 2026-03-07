import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { toast } from '@/hooks/use-toast'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'
import { getOrganizationTree } from '@/lib/organizationHelpers'
import { checkForDuplicateCandidate, createCandidate, DuplicateCheckResult } from '@/lib/candidateHelpers'

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

export interface IndependentCandidate {
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
  contact_emails?: ContactEmail[] | null
  contact_phones?: ContactPhone[] | null
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

export interface DuplicateResult {
  isDuplicate: true
  existingCandidate: IndependentCandidate
  incomingData: CreateIndependentCandidateData
  mergedData: any
}

export function useIndependentCandidates() {
  const [candidates, setCandidates] = useState<IndependentCandidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, organizationId, userType } = useAuth()
  const { tenant } = useTenant()
  const orgTreeRef = useRef<string[] | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Reset org tree cache when organizationId changes
  useEffect(() => {
    orgTreeRef.current = null
  }, [organizationId])

  const getCandidates = async () => {
    if (!user || !organizationId) return

    setIsLoading(true)
    setError(null)

    try {
      log.debug('Fetching independent candidates for organization:', organizationId)
      
      // Use cached org tree or fetch once
      if (!orgTreeRef.current) {
        orgTreeRef.current = await getOrganizationTree(organizationId)
      }
      const orgIds = orgTreeRef.current
      log.debug('Fetching candidates from org tree:', orgIds)
      
      const { data, error: fetchError } = await withAuthRetry(async () =>
        await supabase
          .from('candidates')
          .select('id,candidate_name,email,phone,contact_phones,contact_emails,location_country,location_state,location_city,salary_amount,salary_currency,salary_period,profile_summary,linkedin_url,resume_url,skills,auto_generated_skills,status,source,created_at,updated_at,created_by,organization_id')
          .in('organization_id', orgIds)
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

  const addCandidate = async (candidateData: CreateIndependentCandidateData): Promise<IndependentCandidate | DuplicateResult | null> => {
    if (!user || !organizationId) throw new Error('User not authenticated or no organization context')

    setIsLoading(true)
    setError(null)

    try {
      log.debug('Adding independent candidate:', candidateData)
      
      // Check for duplicates using shared helper - pass tenantId for cross-tenant isolation
      const duplicateCheck = await checkForDuplicateCandidate(candidateData, organizationId, tenant?.id)
      
      if (duplicateCheck) {
        // Found duplicate - return for UI to handle
        return {
          isDuplicate: true,
          existingCandidate: duplicateCheck.existingCandidate as IndependentCandidate,
          incomingData: candidateData,
          mergedData: duplicateCheck.mergedData
        }
      }

      // Create candidate using shared helper
      const newCandidate = await createCandidate({
        ...candidateData,
        candidate_name: candidateData.candidate_name,
        organization_id: organizationId,
        created_by: user.id,
        status: candidateData.status || 'available',
        source: candidateData.source || 'direct'
      })

      toast({
        title: 'Success',
        description: 'Candidate added successfully'
      })

      await getCandidates()
      return {
        ...newCandidate,
        auto_generated_skills: (newCandidate.auto_generated_skills as any) || null
      } as IndependentCandidate
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
      
      // Platform admins must use the admin-operations edge function
      // This ensures all admin actions are audited
      if (userType === 'platform_admin') {
        log.debug('Platform admin deleting candidate via edge function:', id)
        const { data, error: edgeFunctionError } = await supabase.functions.invoke('admin-operations', {
          body: { 
            action: 'delete-candidate',
            candidate_id: id 
          }
        })

        if (edgeFunctionError) {
          log.error('Error calling admin-operations edge function:', edgeFunctionError)
          throw edgeFunctionError
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to delete candidate')
        }

        log.debug('Candidate deleted via admin edge function:', data)
        toast({
          title: 'Success',
          description: data.message || 'Candidate deleted successfully'
        })
      } else {
        // Workspace owners can delete directly via RLS
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
      }
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

  // Add real-time subscription for candidates across organization hierarchy
  useEffect(() => {
    if (!user?.id || !organizationId) return

    console.log('🔄 Setting up real-time subscriptions for candidates')
    
    let channel: any
    
    const setupSubscription = async () => {
      // Use cached org tree or fetch
      if (!orgTreeRef.current) {
        orgTreeRef.current = await getOrganizationTree(organizationId)
      }
      const orgIds = orgTreeRef.current
      console.log('📡 Setting up subscriptions for org tree:', orgIds)
      
      // Create unique channel name to avoid subscription conflicts
      const channelId = Math.random().toString(36).substr(2, 9)
      
      channel = supabase.channel(`candidates-changes-${channelId}`)
      
      // Add a listener for each org ID in the hierarchy
      orgIds.forEach(orgId => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'candidates',
            filter: `organization_id=eq.${orgId}`
          },
          (payload) => {
            console.log('📡 Real-time candidate change detected:', payload)
            // Debounce: wait 2s after last change before refreshing
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              getCandidates()
            }, 2000)
          }
        )
      })
      
      channel.subscribe((status) => {
        console.log('📡 Candidates subscription status:', status)
      })
    }

    setupSubscription()

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (channel) {
        console.log('🔄 Cleaning up candidates subscription')
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id, organizationId])

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