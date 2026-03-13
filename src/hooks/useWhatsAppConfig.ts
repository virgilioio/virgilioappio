import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { useCallback, useMemo } from 'react'

/**
 * WhatsApp session states for the QR/session-based model.
 * Reusable across all WhatsApp surfaces in the ATS.
 */
export type WhatsAppSessionStatus =
  | 'disconnected'       // No session exists
  | 'waiting_for_qr'     // QR code generated, waiting for user to scan
  | 'connecting'         // QR scanned, establishing session
  | 'connected'          // Session active, ready for sync
  | 'syncing'            // Actively syncing conversations
  | 'reconnect_required' // Session dropped, needs re-authentication
  | 'expired'            // Session timed out
  | 'error'              // Something went wrong

export interface WhatsAppSessionState {
  status: WhatsAppSessionStatus
  label: string
  description: string
  canSync: boolean
  canMessage: boolean
  actionLabel: string | null
  actionType: 'connect' | 'reconnect' | 'disconnect' | null
}

const SESSION_STATES: Record<WhatsAppSessionStatus, Omit<WhatsAppSessionState, 'status'>> = {
  disconnected: {
    label: 'Not connected',
    description: 'Connect your WhatsApp to start syncing conversations with candidates.',
    canSync: false,
    canMessage: false,
    actionLabel: 'Connect WhatsApp',
    actionType: 'connect',
  },
  waiting_for_qr: {
    label: 'Scan QR code',
    description: 'Open WhatsApp on your phone and scan the QR code to connect.',
    canSync: false,
    canMessage: false,
    actionLabel: null,
    actionType: null,
  },
  connecting: {
    label: 'Connecting…',
    description: 'Establishing connection with WhatsApp. This usually takes a few seconds.',
    canSync: false,
    canMessage: false,
    actionLabel: null,
    actionType: null,
  },
  connected: {
    label: 'Connected',
    description: 'Your WhatsApp is connected and conversations are being synced.',
    canSync: true,
    canMessage: true,
    actionLabel: 'Disconnect',
    actionType: 'disconnect',
  },
  syncing: {
    label: 'Syncing…',
    description: 'Importing your WhatsApp conversations. This may take a few minutes.',
    canSync: true,
    canMessage: false,
    actionLabel: null,
    actionType: null,
  },
  reconnect_required: {
    label: 'Reconnect required',
    description: 'Your WhatsApp session was disconnected. Please reconnect to resume syncing.',
    canSync: false,
    canMessage: false,
    actionLabel: 'Reconnect',
    actionType: 'reconnect',
  },
  expired: {
    label: 'Session expired',
    description: 'Your WhatsApp session has expired. Please reconnect to continue.',
    canSync: false,
    canMessage: false,
    actionLabel: 'Reconnect',
    actionType: 'reconnect',
  },
  error: {
    label: 'Connection error',
    description: 'Something went wrong with your WhatsApp connection. Please try again.',
    canSync: false,
    canMessage: false,
    actionLabel: 'Retry connection',
    actionType: 'connect',
  },
}

/**
 * Returns the full session state object for a given status.
 */
export function getWhatsAppSessionState(status: WhatsAppSessionStatus): WhatsAppSessionState {
  return { status, ...SESSION_STATES[status] }
}

/**
 * Core hook for WhatsApp workspace configuration.
 * Manages session state and workspace-level settings.
 */
export function useWhatsAppConfig() {
  const { automation, isLoading, isSaving, save: baseSave, toggle } = useWorkspaceAutomation('whatsapp_config')

  const config = automation?.config || {}
  const isActive = automation?.is_active ?? false

  const sessionStatus = useMemo((): WhatsAppSessionStatus => {
    const status = config.session_status as string | undefined
    if (status && status in SESSION_STATES) return status as WhatsAppSessionStatus
    return 'disconnected'
  }, [config])

  const isConnected = sessionStatus === 'connected' || sessionStatus === 'syncing'
  const isEnabled = isActive && isConnected

  const connectedPhone = useMemo(
    () => (config.connected_phone as string) || '',
    [config]
  )

  const connectedAt = useMemo(
    () => (config.connected_at as string) || null,
    [config]
  )

  const lastSyncAt = useMemo(
    () => (config.last_sync_at as string) || null,
    [config]
  )

  const lastError = useMemo(
    () => (config.last_error as string) || null,
    [config]
  )

  const conversationCount = useMemo(
    () => (config.conversation_count as number) || 0,
    [config]
  )

  const updateSessionStatus = useCallback(
    (status: WhatsAppSessionStatus, extra?: Record<string, unknown>) => {
      return baseSave({
        config: { ...config, session_status: status, last_error: null, ...extra },
      })
    },
    [baseSave, config]
  )

  const setError = useCallback(
    (errorMessage: string) => {
      return baseSave({
        config: { ...config, session_status: 'error', last_error: errorMessage },
      })
    },
    [baseSave, config]
  )

  const disconnect = useCallback(() => {
    return baseSave({
      is_active: false,
      config: {
        ...config,
        session_status: 'disconnected',
        connected_phone: null,
        connected_at: null,
        last_sync_at: null,
        last_error: null,
      },
    } as any)
  }, [baseSave, config])

  const startConnection = useCallback(() => {
    return baseSave({
      config: { ...config, session_status: 'waiting_for_qr', last_error: null },
    })
  }, [baseSave, config])

  return {
    sessionStatus,
    isConnected,
    isEnabled,
    connectedPhone,
    connectedAt,
    lastSyncAt,
    conversationCount,
    isLoading,
    isSaving,
    isActive,
    lastError,
    config,
    toggle,
    updateSessionStatus,
    setError,
    disconnect,
    startConnection,
  }
}

/**
 * Returns the current WhatsApp session state for the workspace.
 * Reusable across all WhatsApp surfaces.
 */
export function useWhatsAppSessionState(): WhatsAppSessionState & { isLoading: boolean; isEnabled: boolean } {
  const { sessionStatus, isLoading, isEnabled } = useWhatsAppConfig()
  return { ...getWhatsAppSessionState(sessionStatus), isLoading, isEnabled }
}
