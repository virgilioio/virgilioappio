import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface Member {
  id: string
  user_id: string
  system_role: string
  user_status: string
  created_at: string
  updated_at: string
  profile: {
    first_name: string | null
    last_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

export function useCustomerMembers(organizationId: string) {
  return useQuery({
    queryKey: ['customer-members', organizationId],
    queryFn: async (): Promise<Member[]> => {
      if (!organizationId) return []

      const { data: members, error } = await supabase
        .from('members')
        .select(`
          id,
          user_id,
          system_role,
          member_role,
          user_status,
          created_at,
          updated_at
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching members:', error)
        return []
      }

      // Fetch profiles for each member
      const memberIds = members?.map(m => m.user_id) || []
      
      if (memberIds.length === 0) return []

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, avatar_url')
        .in('user_id', memberIds)

      // Merge members with profiles
      const membersWithProfiles = members?.map(member => ({
        ...member,
        profile: profiles?.find(p => p.user_id === member.user_id) || null
      })) || []

      return membersWithProfiles
    },
    enabled: !!organizationId,
  })
}
