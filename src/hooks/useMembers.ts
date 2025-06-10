import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Member {
  id: string
  user_id: string | null
  organization_id: string
  member_role: 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin'
  user_status: 'active' | 'inactive' | 'invited'
  created_at: string
  updated_at: string
  user_email?: string
  organization_name?: string
}

export interface CreateMemberData {
  user_id?: string | null
  organization_id: string
  member_role: 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin'
  user_status?: 'active' | 'inactive' | 'invited'
}

export interface UpdateMemberData {
  member_role?: 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin'
  user_status?: 'active' | 'inactive' | 'invited'
  organization_id?: string
}

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getMembers = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching members for user:', user.id)
      
      // With RLS enabled, the query will automatically filter by organization
      // No need to manually filter by organization_id since RLS handles it
      const { data, error: fetchError } = await supabase
        .from('members')
        .select(`
          *,
          organizations!inner (
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching members:', fetchError)
        // Handle RLS-related errors gracefully
        if (fetchError.message.includes('row-level security')) {
          console.warn('RLS policy blocked access - user may not have permission to view members')
          setMembers([])
          return
        }
        throw fetchError
      }

      console.log('Fetched members:', data)
      
      // Get user emails for members that have user_id
      const membersWithDetails = await Promise.all(
        (data || []).map(async (member) => {
          const typedMember: Member = {
            ...member,
            member_role: member.member_role as 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin',
            user_status: member.user_status as 'active' | 'inactive' | 'invited',
            organization_name: member.organizations?.name
          }
          
          if (member.user_id) {
            try {
              // Note: This admin API call won't work for regular users due to RLS
              // For now, we'll skip email lookup for non-admin users
              if (user.user_metadata?.user_type === 'platform_admin') {
                const { data: userData, error: userError } = await supabase.auth.admin.getUserById(member.user_id)
                if (!userError && userData.user) {
                  return { ...typedMember, user_email: userData.user.email }
                }
              }
            } catch (e) {
              console.warn('Could not fetch user email for member:', member.id)
            }
          }
          return typedMember
        })
      )

      setMembers(membersWithDetails)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch members'
      console.error('Members fetch error:', err)
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

  const createMember = async (data: CreateMemberData) => {
    if (!user) throw new Error('User not authenticated')
    
    // Ensure organization_id is set if not provided
    const organizationId = data.organization_id || user.user_metadata?.organization_id
    if (!organizationId) {
      throw new Error('No organization found for user')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating member:', { ...data, organization_id: organizationId })
      const { data: newMember, error: createError } = await supabase
        .from('members')
        .insert([{ ...data, organization_id: organizationId }])
        .select()
        .single()

      if (createError) {
        console.error('Error creating member:', createError)
        throw createError
      }

      console.log('Created member:', newMember)
      toast({
        title: 'Success',
        description: 'Member invited successfully'
      })

      await getMembers() // Refresh the list
      return newMember
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invite member'
      console.error('Member creation error:', err)
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

  const updateMember = async (id: string, data: UpdateMemberData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating member:', id, data)
      const { data: updatedMember, error: updateError } = await supabase
        .from('members')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating member:', updateError)
        throw updateError
      }

      console.log('Updated member:', updatedMember)
      toast({
        title: 'Success',
        description: 'Member updated successfully'
      })

      await getMembers() // Refresh the list
      return updatedMember
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update member'
      console.error('Member update error:', err)
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

  const deactivateMember = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Deactivating member:', id)
      const { error: updateError } = await supabase
        .from('members')
        .update({ user_status: 'inactive' })
        .eq('id', id)

      if (updateError) {
        console.error('Error deactivating member:', updateError)
        throw updateError
      }

      console.log('Deactivated member:', id)
      toast({
        title: 'Success',
        description: 'Member deactivated successfully'
      })

      await getMembers() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deactivate member'
      console.error('Member deactivation error:', err)
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
      getMembers()
    }
  }, [user])

  return {
    members,
    isLoading,
    error,
    getMembers,
    createMember,
    updateMember,
    deactivateMember
  }
}
