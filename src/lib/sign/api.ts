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
  sender_name: string
  sender_email: string
  sender_user_id: string | null
  scheduled_at: string | null
  sent_at: string | null
  expires_at: string | null
  completed_at: string | null
  updated_at: string
  created_at: string
  recipients: EnvelopeRecipient[]
  documents: { id: string; page_count: number; removed_at: string | null }[]
}

const ENVELOPE_SELECT = `
  id, public_id, title, kind, status, ordered, source_type, source_label, source_sub, origin,
  sender_name, sender_email, sender_user_id, scheduled_at, sent_at, expires_at, completed_at,
  updated_at, created_at,
  recipients:sign_recipients!sign_recipients_envelope_id_fkey(id, position, role, name, email, color, status, user_id, removed_at),
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

/** Template counts by app (Gio Sales or ATS), live templates only. */
export function useTemplateCounts() {
  return useQuery({
    queryKey: ['sign', 'template-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sign_templates')
        .select('app')
        .is('archived_at', null)
      if (error) throw error
      const sales = (data ?? []).filter((t) => t.app === 'sales').length
      return { total: data?.length ?? 0, sales, ats: (data?.length ?? 0) - sales }
    },
    staleTime: 30_000,
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

export const signActions = {
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
}
