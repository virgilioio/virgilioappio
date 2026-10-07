import type { QueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { refreshOnboardingProgress } from '@/utils/refreshOnboardingProgress'

/** Gio addresses the Google popup may report back from. */
function isGioOrigin(origin: string): boolean {
  if (origin === window.location.origin) return true
  try {
    const host = new URL(origin).hostname
    return (
      host === 'app.gogio.io' ||
      host === 'app.virgilio.io' ||
      host === 'localhost' ||
      host.endsWith('.lovable.app') ||
      host.endsWith('.lovableproject.com')
    )
  } catch {
    return false
  }
}

async function readFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body?.error) return String(body.error)
    } catch {
      /* fall through */
    }
  }
  return (error as Error)?.message || 'Something went wrong'
}

async function fetchConnectedSince(userId: string, sinceIso: string) {
  const [mail, cal] = await Promise.all([
    supabase.from('user_mail_identities').select('email_address, updated_at').eq('user_id', userId).gte('updated_at', sinceIso).limit(1),
    supabase.from('calendar_identities').select('email_address, updated_at').eq('user_id', userId).gte('updated_at', sinceIso).limit(1),
  ])
  return (mail.data?.[0] as any)?.email_address ?? (cal.data?.[0] as any)?.email_address ?? null
}

/**
 * The single Google Workspace connect flow (Gmail + Calendar in one consent).
 * The OAuth callback creates both identities and sets up calendar sync and
 * time zone server-side; here we open the popup, refresh state, make sure the
 * booking link is active, and — if the popup can't report back — check what
 * was actually saved once it closes.
 */
export async function startGoogleWorkspaceConnect(queryClient: QueryClient): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  const userId = session.user.id
  const startedAt = new Date(Date.now() - 5_000).toISOString()

  const { data, error } = await supabase.functions.invoke('mail-oauth-start', {
    body: { provider: 'gmail', return_origin: window.location.origin },
  })
  if (error) throw new Error(await readFunctionError(error))
  const { auth_url } = data as { auth_url: string }

  const popup = window.open(auth_url, 'google-workspace-oauth', 'width=520,height=640,scrollbars=yes')
  if (!popup) {
    toast.error('Please allow popups for this site')
    return
  }

  let settled = false
  const refresh = () => {
    for (const key of ['mail-identities', 'calendar-identities', 'booking-config', 'user-profile']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  const finishSuccess = async (email: string | null) => {
    if (settled) return
    settled = true
    cleanup()
    toast.success(`Google Workspace connected${email ? `: ${email}` : ''}`)
    refresh()
    try {
      const { data: tenantRow } = await supabase
        .from('calendar_identities')
        .select('tenant_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      refreshOnboardingProgress(queryClient, userId, (tenantRow as any)?.tenant_id)

      // Booking link: normally activated by a trigger; activate if it wasn't.
      const { data: bookingConfig } = await supabase
        .from('booking_configurations')
        .select('id, is_active')
        .eq('user_id', userId)
        .maybeSingle()
      if (bookingConfig && !bookingConfig.is_active) {
        await supabase.from('booking_configurations').update({ is_active: true }).eq('id', bookingConfig.id)
      }
      queryClient.invalidateQueries({ queryKey: ['booking-config'] })
    } catch (err) {
      console.warn('[GoogleWorkspace] Post-connect setup failed (non-blocking):', err)
    }
  }

  const finishError = (message: string) => {
    if (settled) return
    settled = true
    cleanup()
    toast.error(`Google Workspace not connected: ${message}`)
    refresh()
  }

  const onMessage = (e: MessageEvent) => {
    if (!isGioOrigin(e.origin)) return
    if (e.data?.type === 'mail-oauth-error') finishError(e.data.error || 'Please try again.')
    else if (e.data?.type === 'mail-oauth-success') void finishSuccess(e.data.payload?.email ?? null)
  }

  // Fallback: the popup may not be able to message us (different address,
  // browser isolation). When it closes, read what was actually saved.
  const watcher = window.setInterval(async () => {
    if (!popup.closed || settled) return
    window.clearInterval(watcher)
    await new Promise((r) => setTimeout(r, 800))
    if (settled) return
    const email = await fetchConnectedSince(userId, startedAt)
    if (email) void finishSuccess(email)
    else if (!settled) {
      settled = true
      cleanup()
      refresh()
      toast.message('Google window closed before the connection finished.')
    }
  }, 700)

  function cleanup() {
    window.removeEventListener('message', onMessage)
    window.clearInterval(watcher)
  }

  window.addEventListener('message', onMessage)
}
