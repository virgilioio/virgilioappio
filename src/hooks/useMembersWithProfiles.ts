
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useUserProfile } from './useUserProfile'
import type { Database } from '@/integrations/supabase/types'

export type MemberWithProfile = Database['public']['Tables']['members']['Row'] & {
  user_email?: string
  user_first_name?: string
  user_last_name?: string
}

export function useMembersWithProfiles() {
  const { profile } = useUserProfile()

  const query = useQuery({
    queryKey: ['members_with_profiles', profile?.organization_id],
    queryFn: async () => {
      console.log('Fetching members with profiles for organization:', profile?.organization_id)
      
      const { data: members, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching members:', error)
        throw error
      }

      // Get profile data for members who have user_id
      const membersWithProfiles: MemberWithProfile[] = await Promise.all(
        members.map(async (member) => {
          if (member.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('email, first_name, last_name')
              .eq('user_id', member.user_id)
              .maybeSingle()

            return {
              ...member,
              user_email: profileData?.email || member.invited_email,
              user_first_name: profileData?.first_name,
              user_last_name: profileData?.last_name,
            }
          }
          return {
            ...member,
            user_email: member.invited_email,
          }
        })
      )

      console.log('Fetched members with profiles:', membersWithProfiles)
      return membersWithProfiles
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
