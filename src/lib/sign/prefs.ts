import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export type SignPrefEvent = 'signed' | 'completed' | 'declined' | 'viewed' | 'expiring'
export type SignPref = { by_email: boolean; in_app: boolean }

/**
 * The events a sender hears about. Defaults mirror `sign_pref()` in the
 * database exactly; `email: false` means the event has no email at all.
 */
export const SIGN_PREF_EVENTS: { event: SignPrefEvent; label: string; description: string; email: boolean; defaults: SignPref }[] = [
  { event: 'signed', label: 'Someone signs', description: 'Each signer or approver finishes, and when it’s your turn.', email: true, defaults: { by_email: true, in_app: true } },
  { event: 'completed', label: 'Everyone has signed', description: 'The last person signs and the envelope is complete.', email: true, defaults: { by_email: true, in_app: true } },
  { event: 'declined', label: 'Someone declines', description: 'A signer declines, with their reason.', email: true, defaults: { by_email: true, in_app: true } },
  { event: 'viewed', label: 'Someone opens it', description: 'The first time each person opens it after their code. In-app only.', email: false, defaults: { by_email: false, in_app: true } },
  { event: 'expiring', label: 'Expires soon', description: 'Three days before the links stop working. You always hear when one expires.', email: true, defaults: { by_email: true, in_app: false } },
]

const key = (tenantId: string | null | undefined, email: string) => ['sign', 'prefs', tenantId, email] as const

export function useSignPrefs() {
  const { organizationId, user } = useAuth()
  const email = String(user?.email ?? '').toLowerCase()
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: key(organizationId, email),
    enabled: !!organizationId && !!email,
    queryFn: async (): Promise<Record<SignPrefEvent, SignPref>> => {
      const { data, error } = await supabase
        .from('sign_notification_prefs')
        .select('event, by_email, in_app')
        .eq('tenant_id', organizationId!)
        .eq('email', email)
      if (error) throw error
      const out = Object.fromEntries(SIGN_PREF_EVENTS.map((e) => [e.event, { ...e.defaults }])) as Record<SignPrefEvent, SignPref>
      for (const r of data ?? []) {
        if (r.event in out) out[r.event as SignPrefEvent] = { by_email: r.by_email, in_app: r.in_app }
      }
      return out
    },
  })

  const save = useMutation({
    mutationFn: async (v: { event: SignPrefEvent; pref: SignPref }) => {
      const { error } = await supabase
        .from('sign_notification_prefs')
        .upsert({ tenant_id: organizationId!, email, event: v.event, by_email: v.pref.by_email, in_app: v.pref.in_app, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onMutate: async (v) => {
      const k = key(organizationId, email)
      await qc.cancelQueries({ queryKey: k })
      const before = qc.getQueryData<Record<SignPrefEvent, SignPref>>(k)
      if (before) qc.setQueryData(k, { ...before, [v.event]: v.pref })
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key(organizationId, email), ctx.before)
    },
  })

  return { ...q, save }
}
