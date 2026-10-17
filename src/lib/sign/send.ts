import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { EnvelopeRow, SignKind, SignRecipientRole } from './api'

/**
 * Sending is live (build step 8: the minute job sends what's due and emails
 * every invitation). VITE_SIGN_SENDING=off hides the Send buttons again.
 */
export const SIGN_SENDING_LIVE = import.meta.env.VITE_SIGN_SENDING !== 'off'

export type SendSource =
  | { type: 'candidate'; id: string; jobId: string }
  | { type: 'member'; id: string }

export interface SendRole {
  id: string
  label: string
  role: SignRecipientRole
  fixed: boolean
  color: string
  name: string
  email: string
}

export interface SendPreview {
  label: string
  values: Record<string, string>
  /** Labels of data fields the record has no value for. Sending is refused until they're filled. */
  missing: string[]
  /** The values this template fills in, with labels (empty when it has no data fields). */
  used?: { key: string; label: string; value: string | null }[]
  roles: SendRole[]
}

export interface SendTemplate {
  id: string
  name: string
  description: string | null
  kind: SignKind
  subject: string
  body: string
  docs: number
  pages: number
  roles: string[]
}

const kindOf = (s: SendSource): SignKind => (s.type === 'member' ? 'member' : 'candidate')

/** Live ATS templates of the record's type (members can read these; RLS decides). */
export function useSendTemplates(source: SendSource | null) {
  const kind = source ? kindOf(source) : null
  return useQuery({
    queryKey: ['sign', 'send-templates', kind],
    enabled: !!kind,
    queryFn: async (): Promise<SendTemplate[]> => {
      const { data, error } = await supabase
        .from('sign_templates')
        .select(`
          id, name, description, kind, subject, body,
          docs:sign_documents!sign_documents_template_id_fkey(page_count, removed_at),
          roles:sign_recipients!sign_recipients_template_id_fkey(label, position, removed_at)
        `)
        .eq('app', 'ats')
        .eq('kind', kind!)
        .is('archived_at', null)
        .order('name')
      if (error) throw error
      type Raw = Omit<SendTemplate, 'docs' | 'pages' | 'roles'> & {
        docs: { page_count: number; removed_at: string | null }[]
        roles: { label: string | null; position: number; removed_at: string | null }[]
      }
      return ((data ?? []) as unknown as Raw[]).map((t) => {
        const docs = (t.docs ?? []).filter((d) => !d.removed_at)
        return {
          ...t,
          docs: docs.length,
          pages: docs.reduce((a, d) => a + d.page_count, 0),
          roles: (t.roles ?? [])
            .filter((r) => !r.removed_at)
            .sort((a, b) => a.position - b.position)
            .map((r) => r.label ?? ''),
        }
      })
    },
    staleTime: 30_000,
  })
}

/** What the record fills in for this template, and who signs (first signer prefilled). */
export function useSendPreview(templateId: string | null, source: SendSource | null) {
  return useQuery({
    queryKey: ['sign', 'send-preview', templateId, source?.type, source?.id, source?.type === 'candidate' ? source.jobId : null],
    enabled: !!templateId && !!source,
    retry: false,
    queryFn: async (): Promise<SendPreview> => {
      const { data, error } = await supabase.rpc('sign_send_preview', {
        _template_id: templateId!,
        _source_type: source!.type,
        _source_id: source!.id,
        _job_id: source!.type === 'candidate' ? source!.jobId : null,
      })
      if (error) throw error
      return data as unknown as SendPreview
    },
  })
}

/** A readable reason for a refused send; the database's own messages are written for people. */
export function sendErrorMessage(e: unknown) {
  const err = e as { code?: string; message?: string }
  if (err?.code && /^GSN\d\d$/.test(err.code) && err.message) return err.message
  if (err?.code === '42501') return 'You can’t send agreements for this record.'
  return 'Couldn’t send it. Nothing went out; try again.'
}

export async function sendEnvelope(args: {
  templateId: string
  source: SendSource
  people: { role_id: string; name: string; email: string }[]
  sendAt: Date | null
  subject: string | null
  body: string | null
}) {
  const { data, error } = await supabase.rpc('sign_send', {
    _template_id: args.templateId,
    _source_type: args.source.type,
    _source_id: args.source.id,
    _job_id: args.source.type === 'candidate' ? args.source.jobId : null,
    _people: args.people as never,
    _send_at: args.sendAt ? args.sendAt.toISOString() : null,
    _subject: args.subject,
    _body: args.body,
  })
  if (error) throw error
  return data as string
}

/**
 * Undo a send inside its window: the envelope goes back to a draft and is
 * removed, so nothing is left behind on the record. False once it's gone out.
 */
export async function undoSend(envelopeId: string) {
  const { data, error } = await supabase.rpc('sign_undo_send', { _envelope_id: envelopeId })
  if (error) throw error
  if (!data) return false
  const { error: e2 } = await supabase.rpc('sign_set_draft_removed', { _envelope_id: envelopeId, _removed: true })
  if (e2) throw e2
  return true
}

const RECORD_SELECT = `
  id, public_id, title, kind, status, ordered, source_type, source_label, source_sub, origin,
  sender_name, sender_email, sender_user_id, scheduled_at, sent_at, expires_at, completed_at,
  sealed_path, certificate_path, seal_error, seal_attempts, updated_at, created_at,
  recipients:sign_recipients!sign_recipients_envelope_id_fkey(id, position, role, label, name, email, color, status, user_id, removed_at),
  documents:sign_documents!sign_documents_envelope_id_fkey(id, page_count, removed_at)
`

/** Envelopes for one record (a candidate on a job, or a member), kept live. */
export function useRecordEnvelopes(source: SendSource | null) {
  const qc = useQueryClient()
  const key = ['sign', 'record', source?.type, source?.id, source?.type === 'candidate' ? source.jobId : null]
  useEffect(() => {
    if (!source) return
    const channel = supabase
      .channel(`sign-record-${source.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sign_envelopes' }, () =>
        qc.invalidateQueries({ queryKey: ['sign', 'record'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc, source?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return useQuery({
    queryKey: key,
    enabled: !!source,
    queryFn: async (): Promise<EnvelopeRow[]> => {
      let q = supabase.from('sign_envelopes').select(RECORD_SELECT).is('deleted_at', null)
      q =
        source!.type === 'candidate'
          ? q.eq('ats_candidate_id', source!.id).eq('ats_job_id', source!.jobId)
          : q.eq('source_type', 'member').eq('source_id', source!.id)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(50)
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
