import { useWorkspaceAutomation } from './useWorkspaceAutomation'

export function useWhatsAppEnabled() {
  const { automation, isLoading } = useWorkspaceAutomation('whatsapp_integration')
  return {
    isEnabled: !isLoading && (automation?.is_active ?? false),
    isLoading,
    messageTemplate: automation?.body ?? null,
  }
}
