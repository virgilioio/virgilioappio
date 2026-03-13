import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { useCallback, useMemo } from 'react'

/**
 * WhatsApp connection status for QR/session-based model.
 * Replaces the old Twilio provisioning states.
 */
export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'expired'

export interface WhatsAppConnectionState {
  status: WhatsAppConnectionStatus
  label: string
  description: string
  canMessage: boolean
}

const CONNECTION_STATES: Record<WhatsAppConnectionStatus, Omit<WhatsAppConnectionState, 'status'>> = {
  disconnected: {
    label: 'Not connected',
    description: 'Connect your WhatsApp to start syncing conversations with candidates.',
    canMessage: false,
  },
  connecting: {
    label: 'Connecting…',
    description: 'Scan the QR code with your WhatsApp to complete the connection.',
    canMessage: false,
  },
  connected: {
    label: 'Connected',
    description: 'Your WhatsApp is connected. Conversations are being synced.',
    canMessage: true,
  },
  expired: {
    label: 'Session expired',
    description: 'Your WhatsApp session has expired. Please reconnect.',
    canMessage: false,
  },
}

export function useWhatsAppConfig() {
  const { automation, isLoading, isSaving, save: baseSave, toggle } = useWorkspaceAutomation('whatsapp_config')

  const config = automation?.config || {}
  const isActive = automation?.is_active ?? false

  const connectionStatus = useMemo((): WhatsAppConnectionStatus => {
    const status = config.connection_status as string | undefined
    if (status === 'connected') return 'connected'
    if (status === 'connecting') return 'connecting'
    if (status === 'expired') return 'expired'
    return 'disconnected'
  }, [config])

  const isConnected = connectionStatus === 'connected'

  const connectedPhone = useMemo(
    () => (config.connected_phone as string) || '',
    [config]
  )

  const connectedAt = useMemo(
    () => (config.connected_at as string) || null,
    [config]
  )

  const lastError = useMemo(
    () => (config.last_error as string) || null,
    [config]
  )

  const updateConnectionStatus = useCallback(
    (status: WhatsAppConnectionStatus, extra?: Record<string, unknown>) => {
      return baseSave({
        config: { ...config, connection_status: status, ...extra },
      })
    },
    [baseSave, config]
  )

  const disconnect = useCallback(() => {
    return baseSave({
      is_active: false,
      config: { ...config, connection_status: 'disconnected', connected_phone: null, connected_at: null },
    } as any)
  }, [baseSave, config])

  return {
    isConnected,
    connectionStatus,
    connectedPhone,
    connectedAt,
    isLoading,
    isSaving,
    isActive,
    lastError,
    config,
    toggle,
    updateConnectionStatus,
    disconnect,
  }
}

/**
 * Returns the current WhatsApp connection state for the workspace.
 */
export function useWhatsAppConnectionState(): WhatsAppConnectionState & { isLoading: boolean } {
  const { connectionStatus, isLoading } = useWhatsAppConfig()

  const stateInfo = CONNECTION_STATES[connectionStatus]

  return {
    status: connectionStatus,
    ...stateInfo,
    isLoading,
  }
}
