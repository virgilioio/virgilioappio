import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { toast } from '@/hooks/use-toast'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'
import { getOrganizationTree } from '@/lib/organizationHelpers'
import { checkForDuplicateCandidate, createCandidate, DuplicateCheckResult } from '@/lib/candidateHelpers'
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
  standardized_skills: string[] | null
  auto_generated_skills: any[] | null
  status: string
  source: string
  created_at: string
  updated_at: string
  created_by: string | null
  organization_id: string | null
  seniority_level: string | null
  functional_area: string | null
  specialization: string | null
  standardized_title: string | null
  years_experience: number | null
  enrichment_status: string | null
  current_job_title: string | null
  company_current: string | null
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

// Org tree cache (module-level, reset via effect when org changes)
const orgTreeCache = new Map<string, string[]>()

async function fetchIndependentCandidates(organizationId: string): Promise<IndependentCandidate[]> {
  // Resolve org tree (cached)
  let orgIds = orgTreeCache.get(organizationId)
  if (!orgIds) {
    orgIds = await getOrganizationTree(organizationId)
    orgTreeCache.set(organizationId, orgIds)
  }

  const { data, error } = await withAuthRetry(async () =>
    await supabase
      .from('candidates')
      .select('id,candidate_name,email,phone,contact_phones,contact_emails,location_country,location_state,location_city,salary_amount,salary_currency,salary_period,profile_summary,linkedin_url,resume_url,skills,standardized_skills,auto_generated_skills,status,source,created_at,updated_at,created_by,organization_id,seniority_level,functional_area,specialization,standardized_title,years_experience,enrichment_status,current_job_title,company_current')
      .in('organization_id', orgIds)
      .order('created_at', { ascending: false })
      .limit(1000)
  )

  if (error) throw error

  return (data || []).map(candidate => ({
    ...candidate,
    auto_generated_skills: (candidate.auto_generated_skills as any) || null
  })) as IndependentCandidate[]
}

export function useIndependentCandidates() {
  const { user, organizationId, userType } = useAuth()
  const { tenant } = useTenant()
  const queryClient = useQueryClient()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const queryKey = ['independent-candidates', organizationId] as const

  // Clear org tree cache when org changes
  useEffect(() => {
    if (organizationId) orgTreeCache.delete(organizationId)
  }, [organizationId])

  const { data: candidates = [], isLoading, error: queryError } = useQuery({
    queryKey,
    queryFn: () => fetchIndependentCandidates(organizationId!),
    enabled: !!user && !!organizationId,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: false,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch candidates') : null

  // Backward-compat refresh function
  const getCandidates = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
  }, [queryClient])

  const addCandidate = async (
    candidateData: CreateIndependentCandidateData,
    options?: { skipRefresh?: boolean; silent?: boolean }
  ): Promise<IndependentCandidate | DuplicateResult | null> => {
    if (!user || !organizationId) throw new Error('User not authenticated or no organization context')

    try {
      const duplicateCheck = await checkForDuplicateCandidate(candidateData, organizationId, tenant?.id)

      if (duplicateCheck) {
        return {
          isDuplicate: true,
          existingCandidate: duplicateCheck.existingCandidate as IndependentCandidate,
          incomingData: candidateData,
          mergedData: duplicateCheck.mergedData
        }
      }

      const newCandidate = await createCandidate({
        ...candidateData,
        candidate_name: candidateData.candidate_name,
        organization_id: organizationId,
        created_by: user.id,
        status: candidateData.status || 'active',
        source: candidateData.source || 'direct'
      })

      // Handle constraint-based duplicate (23505 caught inside createCandidate)
      if (newCandidate && (newCandidate as any).isDuplicate) {
        return {
          isDuplicate: true,
          existingCandidate: (newCandidate as any).existingCandidate as IndependentCandidate,
          incomingData: candidateData,
          mergedData: (newCandidate as any).mergedData
        }
      }

      if (!options?.silent) {
        toast({ title: 'Success', description: 'Candidate added successfully' })
      }

      if (!options?.skipRefresh) {
        queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
      }

      return {
        ...(newCandidate as any),
        auto_generated_skills: ((newCandidate as any).auto_generated_skills) || null
      } as IndependentCandidate
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Independent candidate creation error:', err)
      if (!options?.silent) {
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      }
      throw err
    }
  }

  const updateCandidate = async (id: string, candidateData: Partial<CreateIndependentCandidateData>) => {
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
      queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
      return updatedCandidate
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Independent candidate update error:', err)
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  const deleteCandidate = async (id: string) => {
    try {
      if (userType === 'platform_admin') {
        const { data, error: edgeFunctionError } = await supabase.functions.invoke('admin-operations', {
          body: { action: 'delete-candidate', candidate_id: id }
        })

        if (edgeFunctionError) throw edgeFunctionError
        if (!data?.success) throw new Error(data?.error || 'Failed to delete candidate')

        toast({ title: 'Success', description: data.message || 'Candidate deleted successfully' })
      } else {
        const { error: deleteError } = await withAuthRetry(async () =>
          await supabase.from('candidates').delete().eq('id', id)
        )
        if (deleteError) throw deleteError
        toast({ title: 'Success', description: 'Candidate deleted successfully' })
      }

      queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Independent candidate deletion error:', err)
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  // Debounced invalidation for real-time
  const debouncedInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
    }, 2000)
  }, [queryClient])

  // Real-time subscription
  useEffect(() => {
    if (!user?.id || !organizationId) return

    let channel: any

    const setupSubscription = async () => {
      let orgIds = orgTreeCache.get(organizationId)
      if (!orgIds) {
        orgIds = await getOrganizationTree(organizationId)
        orgTreeCache.set(organizationId, orgIds)
      }

      const channelId = Math.random().toString(36).substr(2, 9)
      channel = supabase.channel(`candidates-changes-${channelId}`)

      orgIds.forEach(orgId => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'candidates',
            filter: `organization_id=eq.${orgId}`
          },
          () => {
            if ((window as any).__enrichmentActive) return
            debouncedInvalidate()
          }
        )
      })

      channel.subscribe()
    }

    setupSubscription()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (channel) supabase.removeChannel(channel)
    }
  }, [user?.id, organizationId, debouncedInvalidate])

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
