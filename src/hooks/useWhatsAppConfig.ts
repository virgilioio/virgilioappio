import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { useWhatsAppSession } from '@/hooks/useWhatsAppSession'
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
 * 
 * Combines two sources of truth:
 * - workspace_automations (whatsapp_config) → feature toggle (is_active)
 * - whatsapp_sessions table → real session state
 * 
 * The UI should use this hook for all WhatsApp state needs.
 */
export function useWhatsAppConfig() {
  const { automation, isLoading: configLoading, isSaving: configSaving, save: baseSave, toggle } = useWorkspaceAutomation('whatsapp_config')
  const session = useWhatsAppSession()

  const isActive = automation?.is_active ?? false

  // Session state comes from the persisted whatsapp_sessions table
  const sessionStatus = session.sessionStatus
  const isConnected = session.isConnected
  const isEnabled = isActive && isConnected

  const isLoading = configLoading || session.isLoading
  const isSaving = configSaving || session.isSaving

  return {
    sessionStatus,
    isConnected,
    isEnabled,
    connectedPhone: session.connectedPhone,
    connectedAt: session.connectedAt,
    lastSyncAt: session.lastSyncAt,
    conversationCount: session.conversationCount,
    isLoading,
    isSaving,
    isActive,
    lastError: session.lastError,
    qrCodeData: session.qrCodeData,
    config: automation?.config || {},
    toggle,
    updateSessionStatus: session.updateStatus,
    setError: useCallback(
      (errorMessage: string) => {
        return session.updateStatus('error', { last_error: errorMessage })
      },
      [session.updateStatus]
    ),
    disconnect: session.disconnect,
    startConnection: session.startConnection,
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
