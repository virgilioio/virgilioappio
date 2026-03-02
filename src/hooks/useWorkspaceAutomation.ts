import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { useCallback, useMemo } from 'react'

export interface WorkspaceAutomation {
  id: string
  tenant_id: string
  automation_type: string
  is_active: boolean
  subject: string | null
  body: string | null
  from_email: string | null
  config: Record<string, any>
  created_by: string | null
  created_at: string
  updated_at: string
}

async function getTenantId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('user_status', 'active')
    .limit(1)
    .maybeSingle()
  return data?.tenant_id ?? null
}

export function useWorkspaceAutomation(automationType: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const queryKey = useMemo(
    () => ['workspace-automation', automationType, user?.id],
    [automationType, user?.id]
  )

  const { data: automation, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return null
      const tenantId = await getTenantId(user.id)
      if (!tenantId) return null

      const { data, error } = await supabase
        .from('workspace_automations' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('automation_type', automationType)
        .maybeSingle()

      if (error) throw error
      return data as unknown as WorkspaceAutomation | null
    },
    enabled: !!user?.id,
  })

  const upsertMutation = useMutation({
    mutationFn: async (updates: {
      is_active?: boolean
      subject?: string
      body?: string
      from_email?: string
      config?: Record<string, any>
    }) => {
      if (!user?.id) throw new Error('Not authenticated')
      const tenantId = await getTenantId(user.id)
      if (!tenantId) throw new Error('No tenant found')

      const { data, error } = await supabase
        .from('workspace_automations' as any)
        .upsert(
          {
            tenant_id: tenantId,
            automation_type: automationType,
            created_by: user.id,
            ...updates,
          },
          { onConflict: 'tenant_id,automation_type' }
        )
        .select()
        .single()

      if (error) throw error
      return data as unknown as WorkspaceAutomation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: Error) => {
      toast.error(`Failed to save automation: ${error.message}`)
    },
  })

  const save = useCallback(
    (updates: { subject?: string; body?: string; from_email?: string; config?: Record<string, any> }) => {
      return upsertMutation.mutateAsync(updates)
    },
    [upsertMutation]
  )

  const toggle = useCallback(
    (enabled: boolean) => {
      return upsertMutation.mutateAsync({ is_active: enabled })
    },
    [upsertMutation]
  )

  return {
    automation: automation ?? null,
    isLoading,
    isSaving: upsertMutation.isPending,
    save,
    toggle,
  }
}
