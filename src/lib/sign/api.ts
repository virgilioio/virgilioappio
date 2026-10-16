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
