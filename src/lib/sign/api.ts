import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/integrations/supabase/types'

export type SignStatus = Database['public']['Enums']['sign_status']
export type SignKind = Database['public']['Enums']['sign_kind']
export type SignRecipientRole = Database['public']['Enums']['sign_recipient_role']
export type SignRecipientStatus = Database['public']['Enums']['sign_recipient_status']

export interface EnvelopeRecipient {
  id: string
  position: number
  role: SignRecipientRole
  label?: string | null
  name: string | null
  email: string | null
  color: string
  status: SignRecipientStatus
  user_id: string | null
  removed_at: string | null
}

export interface EnvelopeRow {
  id: string
  public_id: string
  title: string
  kind: SignKind
  status: SignStatus
  ordered: boolean
  source_type: Database['public']['Enums']['sign_source']
  source_label: string | null
  source_sub: string | null
  origin: string
  /** The offer this envelope was sent from (null for other agreements). */
  offer_id?: string | null
  /** The offer changed after this was sent (offer_letters_sign_out_of_date). */
  out_of_date?: boolean
  sender_name: string
  sender_email: string
  sender_user_id: string | null
  scheduled_at: string | null
  sent_at: string | null
  expires_at: string | null
  completed_at: string | null
  /** Set once sealed; readable by whoever can see the envelope. */
  sealed_path: string | null
  certificate_path: string | null
  seal_error: string | null
  seal_attempts: number
  updated_at: string
  created_at: string
  recipients: EnvelopeRecipient[]
  documents: { id: string; page_count: number; removed_at: string | null }[]
}

const ENVELOPE_SELECT = `
  id, public_id, title, kind, status, ordered, source_type, source_label, source_sub, origin,
  sender_name, sender_email, sender_user_id, scheduled_at, sent_at, expires_at, completed_at,
  sealed_path, certificate_path, seal_error, seal_attempts, updated_at, created_at,
  recipients:sign_recipients!sign_recipients_envelope_id_fkey(id, position, role, label, name, email, color, status, user_id, removed_at),
  documents:sign_documents!sign_documents_envelope_id_fkey(id, page_count, removed_at)
`

/** Every envelope this person can see (RLS decides), newest activity first, kept live. */
export function useEnvelopes() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('sign-envelopes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sign_envelopes' }, () =>
        qc.invalidateQueries({ queryKey: ['sign', 'envelopes'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sign_recipients' }, () =>
        qc.invalidateQueries({ queryKey: ['sign', 'envelopes'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  return useQuery({
    queryKey: ['sign', 'envelopes'],
    queryFn: async (): Promise<EnvelopeRow[]> => {
      const { data, error } = await supabase
        .from('sign_envelopes')
        .select(ENVELOPE_SELECT)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      return ((data ?? []) as unknown as EnvelopeRow[]).map((e) => ({
        ...e,
        recipients: (e.recipients ?? []).filter((r) => !r.removed_at).sort((a, b) => a.position - b.position),
        documents: (e.documents ?? []).filter((d) => !d.removed_at),
      }))
    },
    staleTime: 15_000,
  })
}

export interface EnvelopeEvent {
  id: number
  kind: string
  label: string
  key: boolean
  actor_name: string | null
  ip: string | null
  created_at: string
  detail: Record<string, unknown>
}

export interface EnvelopeDetail {
  id: string
  subject: string
  body: string
  reminder_days: number
  expiry_days: number
  expires_at: string | null
  void_reason: string | null
  data_snapshot: Record<string, string> | null
  recipients: (EnvelopeRecipient & { decline_reason: string | null; signed_at: string | null })[]
  documents: { id: string; name: string; page_count: number; position: number; removed_at: string | null }[]
  events: EnvelopeEvent[]
}

/** What the details sheet needs on top of the list row: message, documents, people and the audit trail. */
export function useEnvelopeDetail(id: string | null) {
  return useQuery({
    queryKey: ['sign', 'envelope', id],
    enabled: !!id,
    queryFn: async (): Promise<EnvelopeDetail> => {
      const { data, error } = await supabase
        .from('sign_envelopes')
        .select(`
          id, subject, body, reminder_days, expiry_days, expires_at, void_reason, data_snapshot,
          recipients:sign_recipients!sign_recipients_envelope_id_fkey(id, position, role, name, email, color, status, user_id, removed_at, decline_reason, signed_at),
          documents:sign_documents!sign_documents_envelope_id_fkey(id, name, page_count, position, removed_at),
          events:sign_events(id, kind, label, key, actor_name, ip, created_at, detail)
        `)
        .eq('id', id!)
        .single()
      if (error) throw error
      const d = data as unknown as EnvelopeDetail
      return {
        ...d,
        recipients: (d.recipients ?? []).filter((r) => !r.removed_at).sort((a, b) => a.position - b.position),
        documents: (d.documents ?? []).filter((x) => !x.removed_at).sort((a, b) => a.position - b.position),
        events: (d.events ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }
    },
    staleTime: 10_000,
  })
}

/** Fill {{tags}} with the envelope's frozen values; unknown tags stay as written. */
export function fillTags(text: string, values: Record<string, string> | null | undefined) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => values?.[k] ?? m)
}

async function manage(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('sign-manage', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    let payload: { error?: string; message?: string } | null = null
    try {
      payload = ctx && typeof ctx.json === 'function' ? await ctx.json() : null
    } catch {
      payload = null
    }
    throw Object.assign(new Error(payload?.message || 'refused'), { code: payload?.error ?? 'server' })
  }
  return data
}

/** A readable reason when an action is refused; the database's messages are written for people. */
export function signErrorMessage(e: unknown, fallback: string) {
  const err = e as { code?: string; message?: string }
  if (err?.code && /^GSN\d\d$/.test(err.code) && err.message && err.message !== 'refused') return err.message
  return fallback
}

/** Sealing gave up after five attempts; an admin can start again. */
export const sealStuck = (e: Pick<EnvelopeRow, 'status' | 'sealed_path' | 'seal_attempts'>) =>
  e.status === 'completed' && !e.sealed_path && e.seal_attempts >= 5

/** Downloads a sealed file through a one-minute link (the storage policy checks the envelope). */
export async function downloadSealed(path: string, filename: string) {
  const { data, error } = await supabase.storage.from('sign-files').createSignedUrl(path, 60, { download: filename })
  if (error || !data?.signedUrl) throw error ?? new Error('no_url')
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export const sealedName = (title: string, what: 'signed' | 'certificate') =>
  `${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Agreement'} (${what}).pdf`

export const signActions = {
  /** Five fresh sealing attempts (admins); the two-minute run picks it up. */
  async retrySeal(id: string) {
    const { error } = await supabase.rpc('sign_seal_retry', { _envelope_id: id })
    if (error) throw error
  },
  /** Scheduled → Draft. No one has been emailed. */
  async unschedule(id: string) {
    const { error } = await supabase.rpc('sign_unschedule', { _envelope_id: id })
    if (error) throw error
  },
  /** Draft → Scheduled again (Undo of Cancel schedule). */
  async schedule(id: string, at: string) {
    const { error } = await supabase.rpc('sign_schedule', { _envelope_id: id, _at: at })
    if (error) throw error
  },
  /** Remove a draft (soft) or bring it back. */
  async setDraftRemoved(id: string, removed: boolean) {
    const { error } = await supabase.rpc('sign_set_draft_removed', { _envelope_id: id, _removed: removed })
    if (error) throw error
  },
  /** Scheduled → goes out on the next minute run. */
  async sendNow(id: string) {
    const { error } = await supabase.rpc('sign_send_now', { _envelope_id: id })
    if (error) throw error
  },
  /** Fresh links to whoever's turn it is (once an hour at most). */
  async remind(id: string): Promise<{ reminded: number }> {
    return manage({ action: 'remind', envelope_id: id })
  },
  /** Every link stops; people who had one are told the reason. */
  async void(id: string, reason: string): Promise<{ told: number }> {
    return manage({ action: 'void', envelope_id: id, reason })
  },
  /** Change who signs (people who haven't signed) and/or the expiry. */
  async correct(id: string, people: { recipient_id: string; name: string; email: string }[], expiresAt: string | null) {
    const { data, error } = await supabase.rpc('sign_correct', { _envelope_id: id, _people: people as never, _expires_at: expiresAt })
    if (error) throw error
    return data as number
  },
}
