
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

  return {
    members: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { logMemberInvited } = useActivityLogger()

  return useMutation({
    mutationFn: async (memberData: MemberInsert & { invited_email: string }) => {
      console.log('Inviting member:', memberData)
      
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
        console.error('Error inviting member:', error)
        throw error
      }

      console.log('Invited member:', data)
      
      // Log activity
      logMemberInvited(memberData.invited_email)
      
      return data as Member
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast({
        title: 'Success',
        description: 'Member invited successfully',
      })
    },
    onError: (error) => {
      console.error('Error inviting member:', error)
      toast({
        title: 'Error',
        description: 'Failed to invite member',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
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
}

export function useDeleteMember() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (memberId: string) => {
      console.log('Deleting member:', memberId)
      
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId)

      if (error) {
        console.error('Error deleting member:', error)
        throw error
      }

      console.log('Deleted member:', memberId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast({
        title: 'Success',
        description: 'Member removed successfully',
      })
    },
    onError: (error) => {
      console.error('Error deleting member:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      })
    },
  })
}
