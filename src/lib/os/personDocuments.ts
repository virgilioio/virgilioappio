import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'

import { supabase } from '@/integrations/supabase/client'

/**
 * Files on a person's profile (Allan, 2026-11-19): agreements signed outside
 * Gio Sign, uploaded by People & Access admins to an internal member's profile
 * so the person can open them at any time. os_person_documents keeps them; the
 * person reads their own, admins everyone's; removing hides a file and keeps
 * it (Undo puts it back). Files sit in the private bucket person-documents
 * under {tenant}/{user}/ and open on five-minute signed links.
 */

export type DocumentKind = 'agreement' | 'amendment' | 'nda' | 'other'

export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: 'agreement', label: 'Agreement' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'nda', label: 'NDA' },
  { value: 'other', label: 'Other' },
]

export const documentKindLabel = (k: string | null | undefined) =>
  DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? 'Other'

export interface PersonDocument {
  id: string
  tenant_id: string
  user_id: string
  name: string
  kind: DocumentKind
  signed_on: string | null
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
  removed_at: string | null
}

export const DOCUMENT_BUCKET = 'person-documents'
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024
const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}
export const DOCUMENT_ACCEPT = Object.keys(TYPES).map((e) => `.${e}`).join(',')

const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '')

/** The type the storage accepts for a file, by its extension; null for anything else. */
export function documentType(fileName: string): string | null {
  return TYPES[extOf(fileName)] ?? null
}

/** Why a file can't be added, in plain words; null when it can. */
export function documentProblem(file: { name: string; size: number }): string | null {
  if (!documentType(file.name)) return `${file.name} isn't a PDF, Word file or image.`
  if (file.size > DOCUMENT_MAX_BYTES) return `${file.name} is over 25 MB.`
  if (file.size === 0) return `${file.name} is empty.`
  return null
}

/** A readable name from a file name: no extension, no underscores or runs of spaces. */
export function documentName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (base || fileName).slice(0, 200)
}

/** A first guess at the kind, from the file's name; the admin can change it. */
export function guessKind(fileName: string): DocumentKind {
  const s = fileName.toLowerCase()
  if (/\bnda\b|non[\s_-]?disclosure|confidential/.test(s)) return 'nda'
  if (/amend|addendum/.test(s)) return 'amendment'
  return 'agreement'
}

/** Where a file goes: the person's own folder, a fresh id, and a name storage accepts. */
export function documentPath(tenantId: string, userId: string, fileName: string, id: string): string {
  const safe = fileName.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(-120) || 'file'
  return `${tenantId}/${userId}/${id}-${safe}`
}

/** What the database's refusals mean, in plain words. */
export function documentError(e: unknown, fallback: string): string {
  const code = (e as { code?: string } | null)?.code
  if (code === 'GDC02') return 'A signing date can’t be in the future.'
  if (code === 'GEX02') return 'This person is outside Virgilio, so their profile keeps no files.'
  if (code === 'GDC01') return 'This person isn’t in the workspace any more.'
  if (code === '42501') return 'Only People & Access admins can change these files.'
  return fallback
}

const key = (tenantId: string | undefined, userId: string | null | undefined) => ['os-person-documents', tenantId, userId] as const

/** The person's files on their profile, newest first (removed ones left out). */
export function usePersonDocuments(tenantId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: key(tenantId, userId),
    enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<PersonDocument[]> => {
      const { data, error } = await supabase
        .from('os_person_documents' as never)
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('user_id', userId!)
        .is('removed_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as PersonDocument[]
    },
  })
}

/** Uploads a file to the person's folder, then records it. */
export function useUploadPersonDocument(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<PersonDocument> => {
      const problem = documentProblem(file)
      if (problem) throw Object.assign(new Error(problem), { shown: true })
      const contentType = documentType(file.name)!
      const path = documentPath(tenantId!, userId!, file.name, crypto.randomUUID())
      const up = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, { contentType, upsert: false })
      if (up.error) throw up.error
      const { data, error } = await supabase
        .from('os_person_documents' as never)
        .insert({
          tenant_id: tenantId!,
          user_id: userId!,
          name: documentName(file.name),
          kind: guessKind(file.name),
          file_name: file.name.slice(0, 255),
          storage_path: path,
          mime_type: contentType,
          size_bytes: file.size,
        } as never)
        .select('*')
        .single()
      if (error) throw error
      return data as unknown as PersonDocument
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(tenantId, userId) }),
  })
}

/** Name, kind and signing date: the only things that change after upload. */
export function useUpdatePersonDocument(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: { id: string; name: string; kind: DocumentKind; signed_on: string | null }) => {
      const { error } = await supabase
        .from('os_person_documents' as never)
        .update({ name: patch.name.trim(), kind: patch.kind, signed_on: patch.signed_on } as never)
        .eq('id', patch.id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(tenantId, userId) }),
  })
}

/** Removes (hides and keeps) or brings back a file. Shown at once, put back if the save fails. */
export function useSetPersonDocumentRemoved(tenantId: string | undefined, userId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, removed }: { id: string; removed: boolean }) => {
      const { error } = await supabase
        .from('os_person_documents' as never)
        .update({ removed_at: removed ? new Date().toISOString() : null } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key(tenantId, userId) }),
  })
}

/** A five-minute link to the file, or to save it under its own name. */
export async function documentLink(d: Pick<PersonDocument, 'storage_path' | 'file_name'>, download = false): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(d.storage_path, 300, download ? { download: d.file_name } : undefined)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/** The day a file belongs to: when it was signed, else when it was added. */
export const documentDay = (d: Pick<PersonDocument, 'signed_on' | 'created_at'>) => d.signed_on ?? d.created_at.slice(0, 10)

const day = (iso: string) => format(parseISO(iso.length === 10 ? `${iso}T12:00:00` : iso), 'MMM d, yyyy')

/** The line under a file's name: its kind, when it was signed, and who added it when. */
export function documentMeta(d: PersonDocument, nameOf?: (id: string | null) => string) {
  const parts = [documentKindLabel(d.kind)]
  if (d.signed_on) parts.push(`Signed ${day(d.signed_on)}`)
  const by = nameOf && d.uploaded_by ? ` by ${nameOf(d.uploaded_by)}` : ''
  parts.push(`Added ${day(d.created_at)}${by}`)
  return parts.join(' · ')
}
