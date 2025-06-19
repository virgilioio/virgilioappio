
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface BillingPOCMember {
  id: string
  user_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  member_role: string
  user_type: string
}

export function useBillingPOCMembers(organizationId: string | undefined) {
  const [members, setMembers] = useState<BillingPOCMember[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBillingPOCMembers = async () => {
    if (!organizationId) {
      setMembers([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching billing POC eligible members for organization:', organizationId)
      
      const { data: membersData, error: fetchError } = await supabase
        .from('members')
        .select(`
          id,
          user_id,
          member_role,
          user_type,
          profiles!inner(
            first_name,
            last_name,
            email
          )
        `)
        .eq('organization_id', organizationId)
        .eq('user_status', 'active')
        .in('user_type', ['workspace_owner'])
        .not('user_id', 'is', null)

      if (fetchError) {
        console.error('Error fetching billing POC members:', fetchError)
        throw fetchError
      }

      console.log('Fetched billing POC members:', membersData)

      const formattedMembers: BillingPOCMember[] = (membersData || []).map((member: any) => ({
        id: member.id,
        user_id: member.user_id,
        first_name: member.profiles?.first_name || null,
        last_name: member.profiles?.last_name || null,
        email: member.profiles?.email || null,
        member_role: member.member_role,
        user_type: member.user_type
      }))

      setMembers(formattedMembers)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch billing POC members'
      console.error('Billing POC members fetch error:', err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBillingPOCMembers()
  }, [organizationId])

  return {
    members,
    isLoading,
    error,
    refetch: fetchBillingPOCMembers
  }
}
