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
  email?: string
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
      
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false })

      if (membersError) {
        console.error('Error fetching members:', membersError)
        if (membersError.message.includes('row-level security')) {
          console.warn('RLS policy blocked access - user may not have permission to view members')
          setMembers([])
          return
        }
        throw membersError
      }

      console.log('Fetched members:', membersData)

      if (!membersData || membersData.length === 0) {
        console.log('No members found')
        setMembers([])
        return
      }

      // Get organization names separately
      const orgIds = [...new Set(membersData.map(m => m.organization_id).filter(Boolean))]
      let organizationsMap: Record<string, string> = {}
      
      if (orgIds.length > 0) {
        const { data: orgsData } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds)
        
        if (orgsData) {
          organizationsMap = Object.fromEntries(orgsData.map(org => [org.id, org.name]))
        }
      }

      // Get user profiles separately
      const userIds = [...new Set(membersData.map(m => m.user_id).filter(Boolean))]
      let profilesMap: Record<string, any> = {}
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds)
        
        if (profilesData) {
          profilesMap = Object.fromEntries(profilesData.map(profile => [profile.user_id, profile]))
        }
      }

      const membersWithDetails = await Promise.all(membersData.map(async (member) => {
        const profile = profilesMap[member.user_id || '']
        
        // Enhanced email resolution with better fallback chain
        let user_email = null
        
        // 1. Try profile email first (most reliable)
        if (profile?.email) {
          user_email = profile.email
        }
        // 2. Fall back to invited_email (preserved during activation now)
        else if (member.invited_email) {
          user_email = member.invited_email
        }
        // 3. If we have user_id but no profile, try the RPC call
        else if (member.user_id) {
          try {
            console.log(`Fetching fallback email for member ${member.id} with user_id ${member.user_id}`)
            const { data: memberInfo } = await supabase.rpc('get_member_display_info', {
              member_user_id: member.user_id
            })
            
            if (memberInfo && memberInfo.length > 0) {
              user_email = memberInfo[0].email
              console.log(`Fallback email resolved: ${user_email}`)
            }
          } catch (error) {
            console.warn('Failed to fetch fallback email for member:', member.id, error)
          }
        }
        
        const typedMember: Member = {
          ...member,
          member_role: member.member_role as 'recruiter' | 'customer_success' | 'billing' | 'sales' | 'admin' | 'client',
          user_status: member.user_status as 'active' | 'inactive' | 'invited',
          user_type: member.user_type as 'guest' | 'member' | 'workspace_owner' | 'platform_admin',
          organization_name: organizationsMap[member.organization_id] || null,
          user_first_name: profile?.first_name || null,
          user_last_name: profile?.last_name || null,
          user_email: user_email
        }
        
        return typedMember
      }))

      console.log('Final members with details:', membersWithDetails)
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

  const getInviteUrl = async (memberId: string) => {
    try {
      const { data: member, error } = await supabase
        .from('members')
        .select('invite_token')
        .eq('id', memberId)
        .eq('user_status', 'invited')
        .single()

      if (error || !member?.invite_token) {
        throw new Error('No valid invitation token found')
      }

      // Use dynamic base URL - use window.location.origin for current domain
      const baseUrl = window.location.origin
      return `${baseUrl}/accept-invite/${member.invite_token}`
    } catch (error) {
      console.error('Failed to get invite URL:', error)
      throw error
    }
  }

  const syncSeatsAfterChange = async () => {
    try {
      console.log('Invoking update-seat-quantity after member change')
      const { data, error } = await supabase.functions.invoke('update-seat-quantity')
      if (error) {
        console.warn('update-seat-quantity error (non-fatal):', error)
      } else {
        console.log('update-seat-quantity success:', data)
      }
    } catch (e) {
      console.warn('update-seat-quantity failed (ignored):', e)
    }
  }

  const createMember = async (data: CreateMemberData) => {
    if (!user) throw new Error('User not authenticated')
    
    if (!data.organization_id) {
      throw new Error('Organization is required for member creation')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating member with organization_id:', data.organization_id, 'Full data:', data)
      
      // Check for email duplication if email is provided
      if (data.email) {
        const emailToCheck = data.email;
        console.log('Checking for existing member with email:', emailToCheck)
        
        // Check for existing member with the same email in any organization
        const { data: existingMember, error: checkError } = await supabase
          .from('members')
          .select('id, invited_email, user_status, organization_name:organizations(name)')
          .or(`invited_email.eq.${emailToCheck}`)
          .limit(1)
          .single()

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error checking for existing member:', checkError)
          throw checkError
        }

        if (existingMember) {
          const orgName = existingMember.organization_name?.name || 'Unknown Organization'
          const memberStatus = existingMember.user_status === 'invited' ? 'pending invitation' : existingMember.user_status
          throw new Error(`A member with email ${emailToCheck} already exists in ${orgName} with status: ${memberStatus}`)
        }
      }
      
      const memberData = {
        organization_id: data.organization_id,
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

      // Send invitation email if creating a new invitation with email
      const emailToInvite = data.email;
      if (!data.user_id && emailToInvite && newMember.invite_token) {
        try {
          const inviteData = await sendInvitationEmail(newMember.id, emailToInvite)
          toast({
            title: 'Success',
            description: `Invitation sent to ${emailToInvite} successfully`
          })
          // Return the invite URL along with the member data
          return { ...newMember, inviteUrl: inviteData?.inviteUrl }
        } catch (emailError) {
          console.error('Failed to send invitation email:', emailError)
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

      await getMembers()
      await syncSeatsAfterChange()
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

      await getMembers()
      await syncSeatsAfterChange()
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

      await getMembers()
      await syncSeatsAfterChange()
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
    resendInvitation,
    getInviteUrl
  }
}
