import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { SignKind, SignRecipientRole } from './api'

/* ------------------------------------------------------------------------- */
/* Model                                                                      */
/* ------------------------------------------------------------------------- */

export type SignApp = 'ats' | 'sales'
export type FieldType = 'signature' | 'initials' | 'date' | 'name' | 'email' | 'text' | 'checkbox' | 'data'
export type SignerFieldType = Exclude<FieldType, 'data'>

export interface TplDoc {
  id: string
  name: string
  storage_path: string
  page_count: number
  /** Points per page, so % positions map onto the PDF. */
  page_sizes: { w: number; h: number }[]
  size_bytes: number
  sha256: string | null
  /** Upload progress while it's going up (0–100); undefined once stored. */
  uploading?: number
  /** Kept locally after an upload so the fields editor doesn't download it again. */
  file?: Blob
}

export interface TplRole {
  id: string
  label: string
  role: SignRecipientRole
  /** A role fixed to one person (the countersigner); otherwise filled when sent. */
  fixed: boolean
  name: string
  email: string
  color: string
}

export interface TplField {
  id: string
  type: FieldType
  /** The role who fills it; null for data fields. */
  rid: string | null
  /** Global page index across the documents, in order. */
  page: number
  x: number
  y: number
  w: number
  h: number
  required: boolean
  data_key: string | null
}

export interface TplDraft {
  id: string
  name: string
  description: string
  kind: SignKind
  app: SignApp
  ordered: boolean
  subject: string
  body: string
  reminder_days: number
  expiry_days: number
  docs: TplDoc[]
  roles: TplRole[]
  fields: TplField[]
  uses: number
}

export interface TemplateRow extends TplDraft {
  created_at: string
  updated_at: string
  archived_at: string | null
}

/* ------------------------------------------------------------------------- */
/* Constants                                                                  */
/* ------------------------------------------------------------------------- */

export const KIND_LABEL: Record<SignKind, string> = { customer: 'Customer', candidate: 'Candidate', member: 'Member' }
export const APP_LABEL: Record<SignApp, string> = { ats: 'Gio ATS', sales: 'Gio Sales' }

/** Role fills, in the order roles are added (from the Sign design). */
export const ROLE_COLORS = ['#D7C5FB', '#BFE3CF', '#F8D7B0', '#BCD7F5', '#F5C6D6'] as const

export const FIELD_LABEL: Record<FieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  date: 'Date signed',
  name: 'Full name',
  email: 'Email',
  text: 'Text',
  checkbox: 'Checkbox',
  data: 'Data field',
}
export const SIGNER_FIELDS: SignerFieldType[] = ['signature', 'initials', 'date', 'name', 'text', 'checkbox']

/** Default size in % of the page (w, h). */
export const FIELD_SIZE: Record<FieldType, [number, number]> = {
  signature: [30, 6.2],
  initials: [11, 5],
  date: [20, 3.6],
  name: [26, 3.6],
  email: [26, 3.6],
  text: [26, 3.6],
  checkbox: [3.6, 2.8],
  data: [26, 3.6],
}

/**
 * Data tags each template type can use, filled from the record when it's sent.
 * They're the values the ATS or Gio Sales actually holds; anything else (guarantee
 * period, commission, hiring manager) waits until it's a real field.
 */
export const DATA_TAGS: Record<SignKind, [string, string][]> = {
  customer: [
    ['company', 'Company'],
    ['contact', 'Contact name'],
    ['contact_email', 'Contact email'],
    ['deal', 'Deal name'],
    ['value', 'Deal value'],
    ['currency', 'Currency'],
    ['fee', 'Fee'],
    ['openings', 'Openings'],
    ['start', 'Start date'],
    ['owner', 'Deal owner'],
  ],
  candidate: [
    ['name', 'Candidate name'],
    ['job', 'Job title'],
    ['salary', 'Salary'],
    ['start', 'Start date'],
  ],
  member: [
    ['name', 'Member name'],
    ['role', 'Role'],
    ['email', 'Member email'],
  ],
}
export const COMMON_TAGS: [string, string][] = [
  ['today', 'Today’s date'],
  ['sender', 'Sender name'],
]
export const tagsFor = (kind: SignKind) => [...DATA_TAGS[kind], ...COMMON_TAGS]
export const tagLabel = (kind: SignKind, key: string) => tagsFor(kind).find(([k]) => k === key)?.[1] ?? key

const DEFAULT_MESSAGE: Record<SignKind, { subject: string; body: string }> = {
  customer: {
    subject: 'Agreement for {{company}} to sign',
    body: 'Hi {{contact}},\n\nHere is the agreement we discussed for {{company}}. Review it and sign where marked.\n\nThanks,\n{{sender}}',
  },
  candidate: {
    subject: 'Your offer for {{job}}',
    body: 'Hi {{name}},\n\nWe’re glad to offer you the {{job}} role. Review the offer and sign where marked.\n\nThanks,\n{{sender}}',
  },
  member: {
    subject: 'Your member agreement',
    body: 'Hi {{name}},\n\nHere is your agreement as {{role}}. Review it and sign where marked.\n\nThanks,\n{{sender}}',
  },
}
const FIRST_ROLE: Record<SignKind, string> = { customer: 'Client signer', candidate: 'Candidate', member: 'Member' }

export const uid = () => crypto.randomUUID()
export const okEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export function newDraft(kind: SignKind = 'candidate'): TplDraft {
  return {
    id: uid(),
    name: '',
    description: '',
    kind,
    app: kind === 'customer' ? 'sales' : 'ats',
    ordered: true,
    ...DEFAULT_MESSAGE[kind],
    reminder_days: 2,
    expiry_days: kind === 'candidate' ? 14 : 30,
    docs: [],
    roles: [{ id: uid(), label: FIRST_ROLE[kind], role: 'signer', fixed: false, name: '', email: '', color: ROLE_COLORS[0] }],
    fields: [],
    uses: 0,
  }
}

/** Switching type swaps in that type's default message (if untouched) and drops data fields it can't use. */
export function withKind(d: TplDraft, kind: SignKind): TplDraft {
  if (d.kind === kind) return d
  const allowed = new Set(tagsFor(kind).map(([k]) => k))
  const untouched = d.subject === DEFAULT_MESSAGE[d.kind].subject && d.body === DEFAULT_MESSAGE[d.kind].body
  return {
    ...d,
    kind,
    app: kind === 'customer' ? 'sales' : d.app === 'sales' && d.kind === 'customer' ? 'ats' : d.app,
    ...(untouched ? DEFAULT_MESSAGE[kind] : null),
    roles: d.roles.map((r, i) => (i === 0 && r.label === FIRST_ROLE[d.kind] ? { ...r, label: FIRST_ROLE[kind] } : r)),
    fields: d.fields.filter((f) => f.type !== 'data' || allowed.has(f.data_key ?? '')),
  }
}

/** A copy that saves as a new template; documents keep their stored files. */
export function duplicateDraft(t: TplDraft): TplDraft {
  const roleIds = new Map(t.roles.map((r) => [r.id, uid()]))
  return {
    ...t,
    id: uid(),
    name: `${t.name} (copy)`.slice(0, 120),
    uses: 0,
    docs: t.docs.map((d) => ({ ...d, id: uid() })),
    roles: t.roles.map((r) => ({ ...r, id: roleIds.get(r.id)! })),
    fields: t.fields.map((f) => ({ ...f, id: uid(), rid: f.rid ? roleIds.get(f.rid) ?? null : null })),
  }
}

export const pageCount = (d: TplDraft) => d.docs.reduce((a, x) => a + x.page_count, 0)

/** Each page across the documents, in order, with its global index. */
export function pagesOf(docs: TplDoc[]) {
  let gi = 0
  return docs.flatMap((doc) => Array.from({ length: doc.page_count }, (_, i) => ({ doc, i, gi: gi++ })))
}

/** Removing a document drops its fields and shifts later pages down. */
export function removeDoc(d: TplDraft, docId: string): TplDraft {
  const gone = new Set(pagesOf(d.docs).filter((p) => p.doc.id === docId).map((p) => p.gi))
  const shift = (g: number) => g - [...gone].filter((z) => z < g).length
  return {
    ...d,
    docs: d.docs.filter((x) => x.id !== docId),
    fields: d.fields.filter((f) => !gone.has(f.page)).map((f) => ({ ...f, page: shift(f.page) })),
  }
}

/** Moving a document moves its fields with it. */
export function moveDoc(d: TplDraft, from: number, to: number): TplDraft {
  if (to < 0 || to >= d.docs.length) return d
  const before = pagesOf(d.docs)
  const docs = [...d.docs]
  ;[docs[from], docs[to]] = [docs[to], docs[from]]
  const after = pagesOf(docs)
  const map = new Map(before.map((p) => [p.gi, after.find((q) => q.doc.id === p.doc.id && q.i === p.i)!.gi]))
  return { ...d, docs, fields: d.fields.map((f) => ({ ...f, page: map.get(f.page) ?? f.page })) }
}

/* ------------------------------------------------------------------------- */
/* Validation (one message per step, shown in the footer)                     */
/* ------------------------------------------------------------------------- */

export function stepIssue(step: number, d: TplDraft): string | null {
  if (step === 0) {
    if (!d.name.trim()) return 'Name the template'
    if (!d.docs.length) return 'Add at least one PDF'
    if (d.docs.some((x) => x.uploading != null)) return 'Waiting for the upload to finish'
    if (pageCount(d) > 200) return 'A template can hold up to 200 pages'
  }
  if (step === 1) {
    if (!d.roles.some((r) => r.role === 'signer')) return 'Add at least one signer'
    if (d.roles.some((r) => !r.label.trim())) return 'Every role needs a name'
    const bad = d.roles.find((r) => r.fixed && (!r.name.trim() || !okEmail(r.email)))
    if (bad) return `${bad.label || 'A fixed role'} needs a name and a valid email`
    const labels = d.roles.map((r) => r.label.trim().toLowerCase())
    if (new Set(labels).size !== labels.length) return 'Two roles have the same name'
  }
  if (step === 2) {
    const m = d.roles.find((r) => r.role === 'signer' && !d.fields.some((f) => f.rid === r.id && f.type === 'signature'))
    if (m) return `${m.label} needs a signature field`
  }
  if (step === 3) {
    if (!d.subject.trim()) return 'Add a subject'
    if (!d.body.trim()) return 'Add a message'
  }
  return null
}

/* ------------------------------------------------------------------------- */
/* Queries                                                                    */
/* ------------------------------------------------------------------------- */

const TEMPLATE_SELECT = `
  id, name, description, kind, app, ordered, subject, body, reminder_days, expiry_days, uses,
  created_at, updated_at, archived_at,
  docs:sign_documents!sign_documents_template_id_fkey(id, name, storage_path, page_count, page_sizes, size_bytes, sha256, position, removed_at),
  roles:sign_recipients!sign_recipients_template_id_fkey(id, label, role, fixed, name, email, color, position, removed_at),
  fields:sign_fields!sign_fields_template_id_fkey(id, type, recipient_id, page, x, y, w, h, required, data_key, removed_at)
`

type Raw = Omit<TemplateRow, 'docs' | 'roles' | 'fields' | 'description'> & {
  description: string | null
  docs: (TplDoc & { position: number; removed_at: string | null })[]
  roles: (Omit<TplRole, 'name' | 'email'> & { name: string | null; email: string | null; label: string | null; position: number; removed_at: string | null })[]
  fields: (Omit<TplField, 'rid' | 'x' | 'y' | 'w' | 'h'> & { recipient_id: string | null; x: number | string; y: number | string; w: number | string; h: number | string; removed_at: string | null })[]
}

function fromRaw(t: Raw): TemplateRow {
  return {
    ...t,
    description: t.description ?? '',
    docs: (t.docs ?? [])
      .filter((x) => !x.removed_at)
      .sort((a, b) => a.position - b.position)
      .map(({ position: _p, removed_at: _r, ...x }) => ({ ...x, page_sizes: Array.isArray(x.page_sizes) ? x.page_sizes : [] })),
    roles: (t.roles ?? [])
      .filter((x) => !x.removed_at)
      .sort((a, b) => a.position - b.position)
      .map((r) => ({ id: r.id, label: r.label ?? '', role: r.role, fixed: r.fixed, name: r.name ?? '', email: r.email ?? '', color: r.color })),
    fields: (t.fields ?? [])
      .filter((x) => !x.removed_at)
      .map((f) => ({
        id: f.id,
        type: f.type,
        rid: f.recipient_id,
        page: f.page,
        x: Number(f.x),
        y: Number(f.y),
        w: Number(f.w),
        h: Number(f.h),
        required: f.required,
        data_key: f.data_key,
      })),
  }
}

/** Every template (live and archived), most recently edited first. */
export function useTemplates() {
  return useQuery({
    queryKey: ['sign', 'templates'],
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await supabase
        .from('sign_templates')
        .select(TEMPLATE_SELECT)
        .order('updated_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return ((data ?? []) as unknown as Raw[]).map(fromRaw)
    },
    staleTime: 15_000,
  })
}

/* ------------------------------------------------------------------------- */
/* Writes                                                                     */
/* ------------------------------------------------------------------------- */

const r3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Save a template: the template, then its documents, roles and fields, by id
 * (upsert), then soft-remove anything the editor dropped. Every write is
 * idempotent, so a failed save can simply be retried. Envelopes already sent
 * keep their own frozen copies and aren't affected.
 */
export async function saveTemplate(d: TplDraft, tenantId: string, userId: string | null) {
  const { error: tErr } = await supabase.from('sign_templates').upsert({
    id: d.id,
    tenant_id: tenantId,
    name: d.name.trim(),
    description: d.description.trim() || null,
    kind: d.kind,
    app: d.app,
    ordered: d.ordered,
    subject: d.subject.trim(),
    body: d.body,
    reminder_days: d.reminder_days,
    expiry_days: d.expiry_days,
    updated_by: userId,
  })
  if (tErr) throw tErr

  if (d.docs.length) {
    const { error } = await supabase.from('sign_documents').upsert(
      d.docs.map((x, i) => ({
        id: x.id,
        tenant_id: tenantId,
        template_id: d.id,
        position: i,
        name: x.name,
        storage_path: x.storage_path,
        page_count: x.page_count,
        page_sizes: x.page_sizes,
        size_bytes: x.size_bytes,
        sha256: x.sha256,
        removed_at: null,
      })),
    )
    if (error) throw error
  }
  if (d.roles.length) {
    const { error } = await supabase.from('sign_recipients').upsert(
      d.roles.map((r, i) => ({
        id: r.id,
        tenant_id: tenantId,
        template_id: d.id,
        position: i + 1,
        role: r.role,
        label: r.label.trim(),
        fixed: r.fixed,
        name: r.fixed ? r.name.trim() : null,
        email: r.fixed ? r.email.trim().toLowerCase() : null,
        color: r.color,
        removed_at: null,
      })),
    )
    if (error) throw error
  }
  if (d.fields.length) {
    const { error } = await supabase.from('sign_fields').upsert(
      d.fields.map((f) => {
        const w = r3(Math.min(f.w, 100))
        const h = r3(Math.min(f.h, 100))
        return {
          id: f.id,
          tenant_id: tenantId,
          template_id: d.id,
          recipient_id: f.type === 'data' ? null : f.rid,
          type: f.type,
          page: f.page,
          x: r3(Math.max(0, Math.min(100 - w, f.x))),
          y: r3(Math.max(0, Math.min(100 - h, f.y))),
          w,
          h,
          required: f.type === 'data' ? true : f.required,
          data_key: f.type === 'data' ? f.data_key : null,
          removed_at: null,
        }
      }),
    )
    if (error) throw error
  }

  // Soft-remove what the editor dropped (fields first: they point at roles).
  const now = new Date().toISOString()
  const drop = async (table: 'sign_fields' | 'sign_recipients' | 'sign_documents', keep: string[]) => {
    let q = supabase.from(table).update({ removed_at: now }).eq('template_id', d.id).is('removed_at', null)
    if (keep.length) q = q.not('id', 'in', `(${keep.join(',')})`)
    const { error } = await q
    if (error) throw error
  }
  await drop('sign_fields', d.fields.map((f) => f.id))
  await drop('sign_recipients', d.roles.map((r) => r.id))
  await drop('sign_documents', d.docs.map((x) => x.id))
}

/** Archive hides a template from senders; Undo (or Restore) brings it back. */
export async function setTemplateArchived(id: string, archived: boolean) {
  const { error } = await supabase
    .from('sign_templates')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}
