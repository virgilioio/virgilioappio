import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useOrgContext } from '@/contexts/OrgContext'
import { toast } from '@/hooks/use-toast'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'
import { getOrganizationTree } from '@/lib/organizationHelpers'

export interface Member {
  id: string
  user_id: string | null
  organization_id: string
  member_role: 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer'
  user_status: 'active' | 'inactive' | 'invited'
  user_type?: 'member' | 'workspace_owner' | 'platform_admin'
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
  member_role: 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer'
  user_status?: 'active' | 'inactive' | 'invited'
  user_type?: 'member' | 'workspace_owner' | 'platform_admin'
  email?: string
}

export interface UpdateMemberData {
  member_role?: 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer'
  user_status?: 'active' | 'inactive' | 'invited'
  organization_id?: string
}

export function useMembers(includeHierarchy: boolean = false) {
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { organizationId } = useOrgContext()

  const getMembers = async () => {
    if (!user || !organizationId) return

    setIsLoading(true)
    setError(null)

    try {
      log.debug('Fetching members for user:', user.id)
      
      // Get organization IDs to query
      let orgIdsToQuery = [organizationId]
      if (includeHierarchy) {
        log.debug('Fetching organization hierarchy for:', organizationId)
        orgIdsToQuery = await getOrganizationTree(organizationId)
        log.debug('Organization hierarchy IDs:', orgIdsToQuery)
      }
      
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .in('organization_id', orgIdsToQuery)
        .order('created_at', { ascending: false })

      if (membersError) {
        log.error('Error fetching members:', membersError)
        if (membersError.message.includes('row-level security')) {
          log.warn('RLS policy blocked access - user may not have permission to view members')
          setMembers([])
          return
        }
        throw membersError
      }

      log.debug('Fetched members:', membersData)

      if (!membersData || membersData.length === 0) {
        log.debug('No members found')
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
            log.debug(`Fetching fallback email for member ${member.id} with user_id ${member.user_id}`)
            const { data: memberInfo } = await supabase.rpc('get_member_display_info', {
              member_user_id: member.user_id
            })
            
            if (memberInfo && memberInfo.length > 0) {
              user_email = memberInfo[0].email
              log.debug(`Fallback email resolved: ${user_email}`)
            }
          } catch (error) {
            log.warn('Failed to fetch fallback email for member:', member.id, error)
          }
        }
        
        const typedMember: Member = {
          ...member,
          member_role: member.member_role as 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer',
          user_status: member.user_status as 'active' | 'inactive' | 'invited',
          user_type: member.user_type as 'member' | 'workspace_owner' | 'platform_admin',
          organization_name: organizationsMap[member.organization_id] || null,
          user_first_name: profile?.first_name || null,
          user_last_name: profile?.last_name || null,
          user_email: user_email
        }
        
        return typedMember
      }))

      log.debug('Final members with details:', membersWithDetails)
      setMembers(membersWithDetails)
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Members fetch error:', err)
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
      log.debug('Sending invitation email for member:', memberId)
      
      const { data, error } = await withAuthRetry(async () =>
        await supabase.functions.invoke('send-invitation', {
          body: {
            memberId,
            email,
            inviterName: user?.email || 'Team Member'
          }
        })
      )

      if (error) {
        log.error('Error sending invitation email:', error)
        throw error
      }

      log.debug('Invitation email sent successfully:', data)
      return data
    } catch (error) {
      log.error('Failed to send invitation email:', error)
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
      log.error('Failed to get invite URL:', error)
      throw error
    }
  }

  const syncSeatsAfterChange = async () => {
    try {
      log.debug('Invoking update-seat-quantity after member change')
      const { data, error } = await supabase.functions.invoke('update-seat-quantity')
      if (error) {
        log.warn('update-seat-quantity error (non-fatal):', error)
      } else {
        log.debug('update-seat-quantity success:', data)
        
        // Show success toast with seat count update
        if (data?.seatQuantity !== undefined) {
          toast({
            title: 'Billing updated',
            description: `Your seat count has been updated to ${data.seatQuantity} ${data.seatQuantity === 1 ? 'seat' : 'seats'}.`,
          })
        }
      }
    } catch (e) {
      log.warn('update-seat-quantity failed (ignored):', e)
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
      log.debug('Creating member with organization_id:', data.organization_id, 'Full data:', data)
      
      // Get the tenant_id for seat limit check
      const { data: orgForSeat } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', data.organization_id)
        .single()
      
      const tenantId = orgForSeat?.tenant_id
      
      // PRE-CHECK: Verify seat limit before creating invitation
      // Only check if adding a billable role (admin or recruiter)
      const isBillableRole = data.member_role === 'admin' || data.member_role === 'recruiter'
      
      if (tenantId && isBillableRole) {
        const { data: seatCheck, error: seatError } = await supabase
          .rpc('check_seat_limit' as any, { p_tenant_id: tenantId }) as any

        if (seatError) {
          log.error('Seat limit check failed:', seatError)
          throw new Error('Failed to verify seat availability. Please try again.')
        }

        if (seatCheck) {
          const limit = seatCheck
          
          // Handle unlimited plans (seat_limit === null means unlimited)
          if (limit.seat_limit === null || limit.seat_limit === undefined) {
            log.debug('Unlimited seat plan detected, allowing invitation')
          } else if (!limit.allowed) {
            // Seat limit reached - throw specific error that UI will catch
            const errorData = {
              type: 'SEAT_LIMIT_REACHED',
              current_seats: limit.current_seats ?? 0,
              seat_limit: limit.seat_limit ?? 0,
              is_trial: limit.is_trial ?? false,
            }
            throw new Error(JSON.stringify(errorData))
          }
        } else {
          // If seatCheck is null/undefined, log warning but don't block
          log.warn('Seat limit check returned no data, allowing operation to proceed')
        }
      }
      
      // Check for email duplication if email is provided
      if (data.email) {
        const emailToCheck = data.email;
        log.debug('Checking for existing member with email:', emailToCheck)
        
        // Check for existing member with the same email in any organization
        const { data: existingMember, error: checkError } = await withAuthRetry(async () =>
          await supabase
            .from('members')
            .select('id, invited_email, user_status, invite_expires_at, organization_name:organizations(name)')
            .or(`invited_email.eq.${emailToCheck}`)
            .limit(1)
            .single()
        )

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          log.error('Error checking for existing member:', checkError)
          throw checkError
        }

        if (existingMember) {
          // If it's an expired invitation, delete it and allow re-invite
          if (existingMember.user_status === 'invited' && existingMember.invite_expires_at) {
            const expiresAt = new Date(existingMember.invite_expires_at)
            const now = new Date()
            
            if (expiresAt < now) {
              log.debug('Removing expired invitation for:', emailToCheck)
              await supabase
                .from('members')
                .delete()
                .eq('id', existingMember.id)
              // Continue with creating new invitation
            } else {
              // Valid invitation exists
              const orgName = existingMember.organization_name?.name || 'Unknown Organization'
              throw new Error(`A pending invitation for ${emailToCheck} already exists in ${orgName}. Please wait for them to accept or delete the existing invitation first.`)
            }
          } else {
            // Active member exists
            const orgName = existingMember.organization_name?.name || 'Unknown Organization'
            const memberStatus = existingMember.user_status === 'invited' ? 'pending invitation' : existingMember.user_status
            throw new Error(`A member with email ${emailToCheck} already exists in ${orgName} with status: ${memberStatus}`)
          }
        }
      }
      
      // Get the tenant_id for this organization
      const { data: orgData } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', data.organization_id)
        .single()
      
      const memberData = {
        organization_id: data.organization_id,
        tenant_id: orgData?.tenant_id,
        member_role: data.member_role,
        user_status: data.user_id ? (data.user_status || 'active') : 'invited',
        user_id: data.user_id || null,
        user_type: data.user_type || 'member',
        invited_email: !data.user_id && data.email ? data.email : null
      }

      log.debug('Inserting member data:', memberData)

      const { data: newMember, error: createError } = await withAuthRetry(async () =>
        await supabase
          .from('members')
          .insert([memberData])
          .select()
          .single()
      )

      if (createError) {
        log.error('Error creating member:', createError)
        throw createError
      }

      log.debug('Created member:', newMember)

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
          log.error('Failed to send invitation email:', emailError)
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
      const errorMessage = extractErrorMessage(err)
      log.error('Member creation error:', err)
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
      log.debug('Updating member:', id, data)
      const { data: updatedMember, error: updateError } = await withAuthRetry(async () =>
        await supabase
          .from('members')
          .update(data)
          .eq('id', id)
          .select()
          .single()
      )

      if (updateError) {
        log.error('Error updating member:', updateError)
        throw updateError
      }

      log.debug('Updated member:', updatedMember)
      toast({
        title: 'Success',
        description: 'Member updated successfully'
      })

      await getMembers()
      await syncSeatsAfterChange()
      return updatedMember
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Member update error:', err)
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
      log.debug('Deactivating member:', id)
      
      // Get member role before deactivating to show in toast
      const member = members.find(m => m.id === id)
      const isBillableRole = member?.member_role === 'admin' || member?.member_role === 'recruiter'
      
      const { error: updateError } = await supabase
        .from('members')
        .update({ user_status: 'inactive' })
        .eq('id', id)

      if (updateError) {
        log.error('Error deactivating member:', updateError)
        throw updateError
      }

      log.debug('Deactivated member:', id)
      
      await getMembers()
      await syncSeatsAfterChange()
      
      // Don't show duplicate toast - syncSeatsAfterChange will show the billing update
      if (!isBillableRole) {
        toast({
          title: 'Success',
          description: 'Member deactivated successfully'
        })
      }
    } catch (err) {
      const errorMessage = extractErrorMessage(err)
      log.error('Member deactivation error:', err)
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
      const errorMessage = extractErrorMessage(error)
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
    if (user && organizationId) {
      getMembers()
    }
  }, [user, organizationId])

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
