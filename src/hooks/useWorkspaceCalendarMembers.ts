import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface CalendarMember {
  userId: string
  name: string
  email: string | null
  colorIndex: number
}

/**
 * Every active workspace member with their stable calendar colour slot.
 * Used by the People filter, the legend and event colouring.
 */
export function useWorkspaceCalendarMembers() {
  const { user } = useAuth()

  const query = useQuery({
    queryKey: ['calendar-members', user?.id],
    queryFn: async (): Promise<CalendarMember[]> => {
      if (!user) return []

      const { data: me } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .maybeSingle()

      if (!me?.tenant_id) return []

      const { data: rows, error } = await supabase
        .from('members')
        .select('user_id, calendar_color_index, user_status')
        .eq('tenant_id', me.tenant_id)
        .eq('user_status', 'active')
        .not('user_id', 'is', null)

      if (error) throw error

      const ids = [...new Set((rows || []).map(r => r.user_id).filter(Boolean))] as string[]
      if (ids.length === 0) return []

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', ids)

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]))

      return ids.map((id, i) => {
        const row = (rows || []).find(r => r.user_id === id)
        const p = profileMap.get(id)
        const name =
          `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || p?.email || 'Teammate'
        return {
          userId: id,
          name,
          email: p?.email ?? null,
          colorIndex: row?.calendar_color_index ?? i % 6,
        }
      })
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const members = query.data ?? []

  const colorIndexByUser = useMemo(
    () => new Map(members.map(m => [m.userId, m.colorIndex])),
    [members],
  )

  const nameByUser = useMemo(() => new Map(members.map(m => [m.userId, m.name])), [members])

  return { members, colorIndexByUser, nameByUser, isLoading: query.isLoading }
}
