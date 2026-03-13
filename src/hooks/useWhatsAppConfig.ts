import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { useWhatsAppSession } from '@/hooks/useWhatsAppSession'
import { useCallback } from 'react'
import { getWhatsAppSessionState } from '@/lib/whatsapp/types'
import type { WhatsAppSessionStatus, WhatsAppSessionState } from '@/lib/whatsapp/types'

// Re-export for consumers that imported from here
export { getWhatsAppSessionState }
export type { WhatsAppSessionStatus, WhatsAppSessionState }

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
