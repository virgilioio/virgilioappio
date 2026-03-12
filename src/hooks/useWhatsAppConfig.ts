import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { useCallback, useMemo } from 'react'

export function useWhatsAppConfig() {
  const { automation, isLoading, isSaving, save: baseSave, toggle } = useWorkspaceAutomation('whatsapp_config')

  const isConfigured = useMemo(
    () => !!automation?.is_active && !!automation?.config?.twilio_from_number,
    [automation]
  )

  const fromNumber = useMemo(
    () => (automation?.config?.twilio_from_number as string) || '',
    [automation]
  )

  const saveNumber = useCallback(
    (number: string) => {
      return baseSave({
        config: { twilio_from_number: number, is_connected: true },
      })
    },
    [baseSave]
  )

  return {
    isConfigured,
    fromNumber,
    isLoading,
    isSaving,
    isActive: automation?.is_active ?? false,
    saveNumber,
    toggle,
  }
}
