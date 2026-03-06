import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { SearchableSelectOption } from '@/components/ui/searchable-select'

export function useRecruiterOptions(organizationId: string | null) {
  return useQuery({
    queryKey: ['recruiter-options', organizationId],
    queryFn: async (): Promise<SearchableSelectOption[]> => {
      if (!organizationId) return []

      const { data: members, error } = await supabase
        .from('members')
        .select('user_id, system_role, user_status')
        .eq('organization_id', organizationId)
        .eq('user_status', 'active')

      if (error) {
        console.error('Error fetching recruiter options:', error)
        return []
      }

      if (!members?.length) return []

      const userIds = members.map(m => m.user_id)

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds)

      return members.map(member => {
        const profile = profiles?.find(p => p.user_id === member.user_id)
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        const label = name || profile?.email || 'Unknown'
        return {
          value: member.user_id,
          label,
          badge: member.member_role === 'admin' ? 'Admin' : 'Recruiter',
        }
      })
    },
    enabled: !!organizationId,
  })
}
