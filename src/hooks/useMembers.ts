import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Member {
  id: string
  user_id: string | null
  organization_id: string
  member_role: 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin' | 'client'
  user_status: 'active' | 'inactive' | 'invited'
  user_type?: 'guest' | 'member' | 'workspace_owner' | 'platform_admin'
  created_at: string
  updated_at: string
  invite_token?: string | null
  invite_expires_at?: string | null
  invited_email?: string | null
  user_email?: string
  user_first_name?: string
  user_last_name?: string
  organization_name?: string
}

export interface CreateMemberData {
  user_id?: string | null
  organization_id: string
  member_role: 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin' | 'client'
  user_status?: 'active' | 'inactive' | 'invited'
  user_type?: 'guest' | 'member' | 'workspace_owner' | 'platform_admin'
  email?: string // For invitation emails
}

export interface UpdateMemberData {
  member_role?: 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin' | 'client'
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
      
      const { data, error: fetchError } = await supabase
        .from('members')
        .select(`
          *,
          organizations!inner (
            name
          ),
          profiles (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching members:', fetchError)
        if (fetchError.message.includes('row-level security')) {
          console.warn('RLS policy blocked access - user may not have permission to view members')
          setMembers([])
          return
        }
        throw fetchError
      }

      console.log('Fetched members:', data)
      
      const membersWithDetails = await Promise.all(
        (data || []).map(async (member) => {
          // Fix: Properly access the profiles data from the joined query
          const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
          
          const typedMember: Member = {
            ...member,
            member_role: member.member_role as 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin' | 'client',
            user_status: member.user_status as 'active' | 'inactive' | 'invited',
            user_type: member.user_type as 'guest' | 'member' | 'workspace_owner' | 'platform_admin',
            organization_name: member.organizations?.name,
            user_first_name: profile?.first_name || null,
            user_last_name: profile?.last_name || null
          }
          
          // Only try to fetch user email for platform admins and only if user_id exists
          if (member.user_id && user.user_metadata?.user_type === 'platform_admin') {
            try {
              const { data: userData, error: userError } = await supabase.auth.admin.getUserById(member.user_id)
              if (!userError && userData.user) {
                return { ...typedMember, user_email: userData.user.email }
              }
            } catch (e) {
              console.warn('Could not fetch user email for member:', member.id, e)
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

  const sendInvitationEmail = async (memberId: string, email: string) => {
    try {
      console.log('Sending invitation email for member:', memberId)
      
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          memberId,
          email,
          inviterName: user?.user_metadata?.first_name || user?.email
        }
      })

      if (error) {
        console.error('Error sending invitation email:', error)
        throw error
      }

      console.log('Invitation email sent successfully:', data)
      return data
    } catch (error) {
      console.error('Failed to send invitation email:', error)
      throw error
    }
  }

  const createMember = async (data: CreateMemberData) => {
    if (!user) throw new Error('User not authenticated')
    
    const organizationId = data.organization_id || user.user_metadata?.organization_id
    if (!organizationId) {
      throw new Error('No organization found for user')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating member:', { ...data, organization_id: organizationId })
      
      // Prepare the member data - include email for invited members
      const memberData = {
        organization_id: organizationId,
        member_role: data.member_role,
        user_status: data.user_id ? (data.user_status || 'active') : 'invited',
        user_id: data.user_id || null,
        user_type: data.user_type || 'member',
        invited_email: !data.user_id && data.email ? data.email : null
      }

      console.log('Inserting member data:', memberData)

      const { data: newMember, error: createError } = await supabase
        .from('members')
        .insert([memberData])
        .select()
        .single()

      if (createError) {
        console.error('Error creating member:', createError)
        throw createError
      }

      console.log('Created member:', newMember)

      // If this is an invitation (no user_id and email provided), send invitation email
      if (!data.user_id && data.email && newMember.invite_token) {
        try {
          await sendInvitationEmail(newMember.id, data.email)
          toast({
            title: 'Success',
            description: `Invitation sent to ${data.email} successfully`
          })
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError)
          // Don't fail the whole operation, but show a warning
          toast({
            title: 'Member Created',
            description: 'Member created but invitation email failed to send. You may need to resend the invitation.',
            variant: 'destructive'
          })
        }
      } else {
        toast({
          title: 'Success',
          description: 'Member added successfully'
        })
      }

      await getMembers() // Refresh the list
      return newMember
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create member'
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

  const resendInvitation = async (memberId: string, email: string) => {
    setIsLoading(true)
    try {
      await sendInvitationEmail(memberId, email)
      toast({
        title: 'Success',
        description: 'Invitation resent successfully'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend invitation'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw error
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
    deactivateMember,
    resendInvitation
  }
}
