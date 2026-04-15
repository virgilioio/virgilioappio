import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface Collaborator {
  id: string
  sourcing_project_id: string
  user_id: string
  added_by: string
  created_at: string
  user_email?: string
  user_first_name?: string
  user_last_name?: string
  user_avatar_url?: string | null
}

export interface TenantMember {
  user_id: string
  email: string
  first_name?: string
  last_name?: string
  avatar_url?: string | null
}

export function useSourcingProjectCollaborators(projectId: string, createdBy?: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const isCreator = user?.id === createdBy

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: ['sourcing-project-collaborators', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sourcing_project_collaborators' as any)
        .select('*')
        .eq('sourcing_project_id', projectId)

      if (error) throw error

      // Enrich with user info from members table
      if (!data || data.length === 0) return []

      const userIds = data.map((c: any) => c.user_id)
      const { data: members } = await (supabase
        .from('members')
        .select('user_id, invited_email') as any)
        .in('user_id', userIds)

      // Get profiles for names/avatars
      const { data: profiles } = await (supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url, email') as any)
        .in('user_id', userIds)

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]))
      const memberMap = new Map((members || []).map((m: any) => [m.user_id, m]))

      return data.map((c: any) => {
        const profile = profileMap.get(c.user_id) as any
        const member = memberMap.get(c.user_id) as any
        return {
          ...c,
          user_email: profile?.email || member?.invited_email || '',
          user_first_name: profile?.first_name || '',
          user_last_name: profile?.last_name || '',
          user_avatar_url: profile?.avatar_url || null,
        } as Collaborator
      })
    },
    enabled: !!projectId,
  })

  // Fetch tenant members for the invite search
  const { data: tenantMembers = [] } = useQuery({
    queryKey: ['tenant-members-for-collab', projectId],
    queryFn: async () => {
      if (!user) return []

      // Get current user's tenant
      const { data: memberData } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .limit(1)
        .single()

      if (!memberData?.tenant_id) return []

      // Get all active members in tenant
      const { data: members } = await supabase
        .from('members')
        .select('user_id, invited_email')
        .eq('tenant_id', memberData.tenant_id)
        .eq('user_status', 'active')
        .not('user_id', 'is', null)

      if (!members) return []

      const userIds = members.map((m: any) => m.user_id).filter(Boolean)
      const { data: profiles } = await (supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url, email') as any)
        .in('user_id', userIds)

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]))

      return members
        .filter((m: any) => m.user_id && m.user_id !== user.id && m.user_id !== createdBy)
        .map((m: any) => {
          const profile = profileMap.get(m.user_id) as any
          return {
            user_id: m.user_id,
            email: profile?.email || m.invited_email || '',
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            avatar_url: profile?.avatar_url || null,
          } as TenantMember
        })
    },
    enabled: !!projectId && isCreator,
  })

  const addCollaborator = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('sourcing_project_collaborators' as any)
        .insert({
          sourcing_project_id: projectId,
          user_id: userId,
          added_by: user!.id,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourcing-project-collaborators', projectId] })
    },
  })

  const removeCollaborator = useMutation({
    mutationFn: async (collaboratorId: string) => {
      const { error } = await supabase
        .from('sourcing_project_collaborators' as any)
        .delete()
        .eq('id', collaboratorId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourcing-project-collaborators', projectId] })
    },
  })

  return {
    collaborators,
    isLoading,
    tenantMembers,
    isCreator,
    addCollaborator,
    removeCollaborator,
  }
}
