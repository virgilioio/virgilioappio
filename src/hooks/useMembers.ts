
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useUserProfile } from './useUserProfile'
import { useActivityLogger } from './useActivityLogger'
import type { Database } from '@/integrations/supabase/types'

export type Member = Database['public']['Tables']['members']['Row']
export type MemberInsert = Database['public']['Tables']['members']['Insert']

export function useMembers() {
  const { profile } = useUserProfile()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { logMemberInvited } = useActivityLogger()

  const query = useQuery({
    queryKey: ['members', profile?.organization_id],
    queryFn: async () => {
      console.log('Fetching members for organization:', profile?.organization_id)
      
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching members:', error)
        throw error
      }

      console.log('Fetched members:', data)
      return data as Member[]
    },
    enabled: !!profile?.organization_id,
  })

  const createMember = useMutation({
    mutationFn: async (memberData: MemberInsert & { invited_email: string }) => {
      console.log('Creating member:', memberData)
      
      const { data, error } = await supabase
        .from('members')
        .insert({
          ...memberData,
          organization_id: profile?.organization_id,
          user_status: 'invited',
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating member:', error)
        throw error
      }

      console.log('Created member:', data)
      
      // Log activity
      logMemberInvited(memberData.invited_email)
      
      return data as Member
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['members_with_profiles'] })
      toast({
        title: 'Success',
        description: 'Member invited successfully',
      })
    },
    onError: (error) => {
      console.error('Error creating member:', error)
      toast({
        title: 'Error',
        description: 'Failed to invite member',
        variant: 'destructive',
      })
    },
  })

  const updateMember = useMutation({
    mutationFn: async ({ id, ...memberData }: Partial<Member> & { id: string }) => {
      console.log('Updating member:', id, memberData)
      
      const { data, error } = await supabase
        .from('members')
        .update(memberData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating member:', error)
        throw error
      }

      console.log('Updated member:', data)
      return data as Member
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['members_with_profiles'] })
      toast({
        title: 'Success',
        description: 'Member updated successfully',
      })
    },
    onError: (error) => {
      console.error('Error updating member:', error)
      toast({
        title: 'Error',
        description: 'Failed to update member',
        variant: 'destructive',
      })
    },
  })

  const deactivateMember = useMutation({
    mutationFn: async (memberId: string) => {
      console.log('Deactivating member:', memberId)
      
      const { data, error } = await supabase
        .from('members')
        .update({ user_status: 'inactive' })
        .eq('id', memberId)
        .select()
        .single()

      if (error) {
        console.error('Error deactivating member:', error)
        throw error
      }

      console.log('Deactivated member:', data)
      return data as Member
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['members_with_profiles'] })
      toast({
        title: 'Success',
        description: 'Member deactivated successfully',
      })
    },
    onError: (error) => {
      console.error('Error deactivating member:', error)
      toast({
        title: 'Error',
        description: 'Failed to deactivate member',
        variant: 'destructive',
      })
    },
  })

  const resendInvitation = useMutation({
    mutationFn: async ({ memberId, email }: { memberId: string; email: string }) => {
      console.log('Resending invitation for member:', memberId, email)
      
      // Update the invite_expires_at to extend the invitation
      const { data, error } = await supabase
        .from('members')
        .update({ 
          invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        })
        .eq('id', memberId)
        .select()
        .single()

      if (error) {
        console.error('Error resending invitation:', error)
        throw error
      }

      console.log('Resent invitation:', data)
      return data as Member
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['members_with_profiles'] })
      toast({
        title: 'Success',
        description: 'Invitation resent successfully',
      })
    },
    onError: (error) => {
      console.error('Error resending invitation:', error)
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive',
      })
    },
  })

  return {
    members: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createMember,
    updateMember,
    deactivateMember,
    resendInvitation,
  }
}
