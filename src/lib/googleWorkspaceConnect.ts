import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { refreshOnboardingProgress } from '@/utils/refreshOnboardingProgress'

/**
 * The single Google Workspace connect flow (Gmail + Calendar in one consent).
 * The OAuth callback creates both identities and sets up calendar sync and
 * time zone server-side; here we only open the popup, refresh state and make
 * sure the booking link is active.
 */
export async function startGoogleWorkspaceConnect(queryClient: QueryClient): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const { data, error } = await supabase.functions.invoke('mail-oauth-start', {
    body: { provider: 'gmail' },
  })
  if (error) throw error
  const { auth_url, code_verifier, state } = data as { auth_url: string; code_verifier: string; state: string }

  localStorage.setItem(`mail_oauth:${state}:code_verifier`, code_verifier)
  localStorage.setItem(`mail_oauth:${state}:provider`, 'gmail')

  const popup = window.open(auth_url, 'google-workspace-oauth', 'width=520,height=640,scrollbars=yes')
  if (!popup) {
    toast.error('Please allow popups for this site')
    return
  }

  const onMessage = async (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'mail-oauth-error') {
      window.removeEventListener('message', onMessage)
      toast.error(e.data.error || 'Failed to connect Google Workspace')
      return
    }
    if (e.data?.type !== 'mail-oauth-success') return
    window.removeEventListener('message', onMessage)

    toast.success(`Google Workspace connected: ${e.data.payload?.email ?? ''}`.trim())
    for (const key of ['mail-identities', 'calendar-identities', 'booking-config', 'user-profile']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const { data: tenantRow } = await supabase
        .from('calendar_identities')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      refreshOnboardingProgress(queryClient, user.id, (tenantRow as any)?.tenant_id)

      // Booking link: normally activated by a trigger; activate if it wasn't.
      const { data: bookingConfig } = await supabase
        .from('booking_configurations')
        .select('id, is_active')
        .eq('user_id', user.id)
        .maybeSingle()
      if (bookingConfig && !bookingConfig.is_active) {
        await supabase.from('booking_configurations').update({ is_active: true }).eq('id', bookingConfig.id)
      }
      queryClient.invalidateQueries({ queryKey: ['booking-config'] })
    } catch (err) {
      console.warn('[GoogleWorkspace] Post-connect setup failed (non-blocking):', err)
    }
  }
  window.addEventListener('message', onMessage)
}
