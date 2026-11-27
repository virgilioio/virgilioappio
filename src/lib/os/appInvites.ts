import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { AppKey } from '@/lib/os/peopleAccess'

/**
 * One person's invitation to Gio Sales or Gio Docs, as the app sees it
 * (2026-11-27). Asked through the os-invite Edge Function, which checks who may
 * ask (os_invite_request) and relays to the app's os-provision. 'link' answers a
 * working link to hand over directly and 'renew' gives the invitation 7 more
 * days; both are written to the person's history. Nothing here is stored.
 */
export type AppInviteState = 'joined' | 'pending' | 'expired' | 'withdrawn' | 'none' | 'switched_off' | 'unknown'

export interface AppInvite {
  state: AppInviteState
  invited_at: string | null
  sent_at: string | null
  expires_at: string | null
  url: string | null
  detail?: string | null
}

export type InviteAction = 'status' | 'link' | 'renew'

/** Gio Sales and Gio Docs: the apps that send invitations. */
export const INVITE_APPS: ReadonlySet<string> = new Set(['sales', 'docs'])

async function errorText(err: unknown, fallback: string): Promise<string> {
  // FunctionsHttpError keeps the response; our function answers { error }.
  const res = (err as { context?: Response } | null)?.context
  if (res && typeof res.json === 'function') {
    try {
      const body = (await res.clone().json()) as { error?: string }
      if (body?.error) return body.error
    } catch {
      /* not JSON */
    }
  }
  return fallback
}

export async function inviteRequest(tenantId: string, userId: string, app: AppKey, action: InviteAction): Promise<AppInvite> {
  const { data, error } = await supabase.functions.invoke('os-invite', {
    body: { tenant_id: tenantId, user_id: userId, app, action },
  })
  if (error) throw new Error(await errorText(error, "Couldn't reach the app. Try again in a minute."))
  return data as AppInvite
}

export const appInviteKey = (tenantId: string | undefined, userId: string | null | undefined, app: string) =>
  ['os-invite', tenantId, userId, app] as const

export function useAppInvite(tenantId: string | undefined, userId: string | null | undefined, app: AppKey, enabled: boolean) {
  return useQuery({
    queryKey: appInviteKey(tenantId, userId, app),
    enabled: enabled && !!tenantId && !!userId && INVITE_APPS.has(app),
    queryFn: () => inviteRequest(tenantId!, userId!, app, 'status'),
    staleTime: 30_000,
    retry: false,
  })
}

export function useRefreshAppInvite() {
  const qc = useQueryClient()
  return (tenantId: string | undefined, userId: string | null | undefined, app: string) =>
    qc.invalidateQueries({ queryKey: appInviteKey(tenantId, userId, app) })
}

/** "Dec 4" (with the year when it isn't this year). */
export function inviteDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** One line under the app's name: where the invitation stands. */
export function inviteSentence(appName: string, i: AppInvite | undefined): string {
  if (!i) return ''
  switch (i.state) {
    case 'joined':
      return `Joined ${appName}.`
    case 'switched_off':
      return `Their ${appName} access is switched off.`
    case 'pending':
      return `Invitation sent ${inviteDay(i.sent_at ?? i.invited_at)} · works until ${inviteDay(i.expires_at)}.`
    case 'expired':
      return `Invitation expired ${inviteDay(i.expires_at)}. Extend it, copy a fresh link or email it again.`
    case 'withdrawn':
    case 'none':
      return 'No open invitation. Email it to send one.'
    default:
      return i.detail ?? ''
  }
}

/** A minute after any send, Email again waits, so nobody gets two emails at once. */
export const RESEND_PAUSE_MS = 60_000
