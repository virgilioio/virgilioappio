import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'

export function useGoogleConnected() {
  const { identities: mail, isLoading: lm } = useMailIdentities()
  const { identities: cal, isLoading: lc } = useCalendarIdentities()
  if (lm || lc) return false
  const mailHealthy = (mail ?? []).some((identity) =>
    identity.is_active !== false && identity.sync_status === 'active'
  )
  const calendarHealthy = (cal ?? []).some((identity) =>
    identity.is_active !== false && identity.sync_status === 'healthy'
  )
  return mailHealthy || calendarHealthy
}

export function useChromeConnected() {
  return false
}

export function useWhatsAppConnected() {
  const { automation, isLoading } = useWorkspaceAutomation('whatsapp_integration')
  if (isLoading) return false
  return automation?.is_active ?? false
}

export function useIntegrationStatuses() {
  const googleConnected = useGoogleConnected()
  const chromeConnected = useChromeConnected()
  const whatsappConnected = useWhatsAppConnected()
  return {
    'chrome-extension': chromeConnected,
    'google-workspace': googleConnected,
    'whatsapp': whatsappConnected,
  } as Record<string, boolean>
}
