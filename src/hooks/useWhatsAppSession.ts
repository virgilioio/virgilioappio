/**
 * useWhatsAppSession — Persisted session state from whatsapp_sessions table.
 * 
 * This replaces the workspace_automations-based config for session state,
 * using the dedicated whatsapp_sessions table as the source of truth.
 * 
 * The workspace_automations config (useWhatsAppConfig) is still used for
 * workspace-level feature toggle (is_active), but session connectivity
 * is now tracked in whatsapp_sessions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useCallback, useMemo } from 'react'
import type { WhatsAppSessionStatus, WhatsAppSession } from '@/lib/whatsapp/types'
import { getWhatsAppSessionState } from '@/lib/whatsapp/types'

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

export function useWhatsAppSession() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['whatsapp-session', user?.id]

  const { data: session, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<WhatsAppSession | null> => {
      if (!user?.id) return null
      const tenantId = await getTenantId(user.id)
      if (!tenantId) return null

      const { data, error } = await supabase
        .from('whatsapp_sessions' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const row = data as any
      return {
        id: row.id,
        tenantId: row.tenant_id,
        provider: row.provider,
        providerSessionId: row.provider_session_id,
        sessionStatus: row.session_status as WhatsAppSessionStatus,
        connectedPhone: row.connected_phone,
        connectedAt: row.connected_at,
        disconnectedAt: row.disconnected_at,
        lastSyncAt: row.last_sync_at,
        lastError: row.last_error,
        conversationCount: row.conversation_count ?? 0,
        qrCodeData: row.qr_code_data,
        qrExpiresAt: row.qr_expires_at,
        providerMetadata: row.provider_metadata ?? {},
      }
    },
    enabled: !!user?.id,
    refetchInterval: (query) => {
      // Poll more frequently during active connection flow
      const status = query.state.data?.sessionStatus
      if (status === 'waiting_for_qr' || status === 'connecting' || status === 'syncing') {
        return 3000
      }
      return 30000
    },
  })

  const sessionStatus = session?.sessionStatus ?? 'disconnected'
  const isConnected = sessionStatus === 'connected' || sessionStatus === 'syncing'
  const sessionState = getWhatsAppSessionState(sessionStatus)

  const upsertMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (!user?.id) throw new Error('Not authenticated')
      const tenantId = await getTenantId(user.id)
      if (!tenantId) throw new Error('No tenant found')

      const { data, error } = await supabase
        .from('whatsapp_sessions' as any)
        .upsert(
          { tenant_id: tenantId, ...updates },
          { onConflict: 'tenant_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const startConnection = useCallback(async () => {
    // In a real implementation, this would call the edge function
    // which calls the provider adapter to get a QR code.
    // For now, update session status to trigger UI flow.
    return upsertMutation.mutateAsync({
      session_status: 'waiting_for_qr',
      last_error: null,
    })
  }, [upsertMutation])

  const disconnect = useCallback(async () => {
    return upsertMutation.mutateAsync({
      session_status: 'disconnected',
      connected_phone: null,
      connected_at: null,
      disconnected_at: new Date().toISOString(),
      last_error: null,
      qr_code_data: null,
    })
  }, [upsertMutation])

  const updateStatus = useCallback(
    (status: WhatsAppSessionStatus, extra?: Record<string, any>) => {
      return upsertMutation.mutateAsync({
        session_status: status,
        last_error: null,
        ...extra,
      })
    },
    [upsertMutation]
  )

  return {
    session,
    sessionStatus,
    isConnected,
    isLoading,
    isSaving: upsertMutation.isPending,
    sessionState,
    startConnection,
    disconnect,
    updateStatus,
    // Convenience accessors
    connectedPhone: session?.connectedPhone ?? null,
    connectedAt: session?.connectedAt ?? null,
    lastSyncAt: session?.lastSyncAt ?? null,
    lastError: session?.lastError ?? null,
    conversationCount: session?.conversationCount ?? 0,
    qrCodeData: session?.qrCodeData ?? null,
  }
}
