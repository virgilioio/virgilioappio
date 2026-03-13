/**
 * useWhatsAppSession — Persisted session state from whatsapp_sessions table.
 * 
 * Combines DB polling with real provider edge function calls.
 * The whatsapp_sessions table is the source of truth for session state,
 * updated by both direct user actions and provider webhook events.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useCallback } from 'react'
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
      const status = query.state.data?.sessionStatus
      if (status === 'waiting_for_qr' || status === 'connecting') {
        return 2000 // Fast poll during QR/connecting
      }
      if (status === 'syncing') {
        return 5000
      }
      return 30000
    },
  })

  const sessionStatus = session?.sessionStatus ?? 'disconnected'
  const isConnected = sessionStatus === 'connected' || sessionStatus === 'syncing'
  const sessionState = getWhatsAppSessionState(sessionStatus)

  // ─── Real provider actions via edge functions ──────────────

  const sessionMutation = useMutation({
    mutationFn: async (params: { action: string; [key: string]: any }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-provider-session', {
        body: params,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const syncMutation = useMutation({
    mutationFn: async (params: { action: string; [key: string]: any }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-provider-sync', {
        body: params,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-all-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-job-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
    },
  })

  const startConnection = useCallback(async () => {
    return sessionMutation.mutateAsync({ action: 'connect' })
  }, [sessionMutation])

  const disconnect = useCallback(async () => {
    return sessionMutation.mutateAsync({ action: 'disconnect' })
  }, [sessionMutation])

  const refreshQr = useCallback(async () => {
    return sessionMutation.mutateAsync({ action: 'refresh_qr' })
  }, [sessionMutation])

  const checkStatus = useCallback(async () => {
    return sessionMutation.mutateAsync({ action: 'status' })
  }, [sessionMutation])

  const syncAll = useCallback(async () => {
    return syncMutation.mutateAsync({ action: 'sync_all' })
  }, [syncMutation])

  const syncConversations = useCallback(async () => {
    return syncMutation.mutateAsync({ action: 'sync_conversations' })
  }, [syncMutation])

  const updateStatus = useCallback(
    async (status: WhatsAppSessionStatus, extra?: Record<string, any>) => {
      // For direct status updates (used by UI for cancel etc.), update DB directly
      if (!user?.id) throw new Error('Not authenticated')
      const tenantId = await getTenantId(user.id)
      if (!tenantId) throw new Error('No tenant found')

      const { error } = await supabase
        .from('whatsapp_sessions' as any)
        .upsert(
          { tenant_id: tenantId, session_status: status, last_error: null, ...extra },
          { onConflict: 'tenant_id' }
        )
      if (error) throw error
      queryClient.invalidateQueries({ queryKey })
    },
    [user?.id, queryClient, queryKey]
  )

  return {
    session,
    sessionStatus,
    isConnected,
    isLoading,
    isSaving: sessionMutation.isPending || syncMutation.isPending,
    sessionState,
    startConnection,
    disconnect,
    refreshQr,
    checkStatus,
    syncAll,
    syncConversations,
    updateStatus,
    // Convenience accessors
    connectedPhone: session?.connectedPhone ?? null,
    connectedAt: session?.connectedAt ?? null,
    lastSyncAt: session?.lastSyncAt ?? null,
    lastError: session?.lastError ?? null,
    conversationCount: session?.conversationCount ?? 0,
    qrCodeData: session?.qrCodeData ?? null,
    qrExpiresAt: session?.qrExpiresAt ?? null,
  }
}
