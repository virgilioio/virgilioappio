import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabaseClient'
import { loadTemplatePdf } from './pdf'
import { layoutWritten, writtenKeys } from '../../../supabase/functions/_shared/sign/writtenLayout.ts'
import { measurePt } from './textLayout'
import type { TplDoc, TplDraft } from './templates'

/**
 * Documents written in Gio (2026-10-17): the editor's own JSON (Lexical),
 * kept next to uploaded PDFs in one order. The server turns each into a PDF
 * when an envelope goes out (_shared/sign/written.ts); the preview here asks
 * the same code for the same PDF (sign-written-preview).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/** A written document: Lexical's own JSON, plus Gio's document settings (Small text). */
export type LexicalJson = { root: Record<string, any>; gio?: { small?: boolean } }

export interface TplWritten {
  id: string
  name: string
  /** Place among all the template's documents, uploaded and written. */
  position: number
  content: LexicalJson
}

export type SignBlockKind = 'signature' | 'initials' | 'date' | 'name'
export const BLOCK_LABEL: Record<SignBlockKind, string> = {
  signature: 'Signature',
  initials: 'Initials',
  date: 'Date signed',
  name: 'Full name',
}

export type IfOp = 'yes' | 'no' | 'filled' | 'empty' | 'equals' | 'not_equals' | 'gt0'
export const IF_LABEL: Record<IfOp, string> = {
  yes: 'is Yes',
  no: 'is No',
  filled: 'is filled in',
  empty: 'is empty',
  equals: 'is',
  not_equals: 'is not',
  gt0: 'is more than 0',
}

export { writtenKeys }

export function emptyContent(): LexicalJson {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [{ type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '', children: [] }],
    },
  }
}

/** Every node of a written document, with whether it sits inside a conditional section. */
export function walkWritten(content: LexicalJson | null | undefined, fn: (node: Record<string, any>, conditional: boolean) => void) {
  const go = (n: Record<string, any> | undefined, cond: boolean) => {
    if (!n) return
    fn(n, cond)
    for (const k of (n.children ?? []) as Record<string, any>[]) go(k, cond || n.type === 'gio-if')
  }
  go(content?.root, false)
}

/** The signing blocks in a written document. */
export function signBlocks(content: LexicalJson | null | undefined) {
  const out: { roleId: string; kind: SignBlockKind; conditional: boolean }[] = []
  walkWritten(content, (n, conditional) => {
    if (n.type === 'gio-sign') out.push({ roleId: String(n.roleId), kind: (n.kind ?? 'signature') as SignBlockKind, conditional })
  })
  return out
}

/** A copy with signing blocks and signer fields pointed at new role ids (duplicating a template). */
export function remapRoles(content: LexicalJson, map: Map<string, string>): LexicalJson {
  const copy = (n: any): any => {
    if (!n || typeof n !== 'object') return n
    const next: any = Array.isArray(n) ? n.map(copy) : Object.fromEntries(Object.entries(n).map(([k, v]) => [k, copy(v)]))
    if (!Array.isArray(n) && (n.type === 'gio-sign' || n.type === 'gio-field') && map.has(n.roleId)) next.roleId = map.get(n.roleId)
    return next
  }
  return copy(content)
}

/**
 * What a written document asks of each role (signing blocks and signer fields,
 * by role id) and how many values it fills in (the Document step's Summary).
 */
export function writtenCounts(content: LexicalJson | null | undefined) {
  const byRole = new Map<string, number>()
  let data = 0
  walkWritten(content, (n) => {
    if ((n.type === 'gio-sign' || n.type === 'gio-field') && n.roleId) byRole.set(String(n.roleId), (byRole.get(String(n.roleId)) ?? 0) + 1)
    if (n.type === 'placeholder') data++
  })
  return { byRole, data }
}

/** Is there anything in it besides empty paragraphs? */
export function hasText(content: LexicalJson | null | undefined) {
  let found = false
  walkWritten(content, (n) => {
    if ((n.type === 'text' && String(n.text ?? '').trim()) || ['placeholder', 'gio-sign', 'gio-field', 'horizontalrule'].includes(n.type)) found = true
  })
  return found
}

/**
 * How many pages a written document comes to, laid out like the sent PDF
 * (tags as their labels, every section shown). An estimate: real values can
 * be longer or shorter, and sections may not print.
 */
export function writtenPageCount(content: LexicalJson): number {
  try {
    return layoutWritten(content, { values: {}, tags: {}, measure: (text, _style, size) => measurePt(text, size) }).pages.length
  } catch {
    return 1
  }
}

/* ------------------------------------------------------------------------- */
/* One order across uploaded and written documents                            */
/* ------------------------------------------------------------------------- */

export type DocItem = { kind: 'upload'; doc: TplDoc; position: number } | { kind: 'written'; doc: TplWritten; position: number }

export function docItems(d: Pick<TplDraft, 'docs' | 'written'>): DocItem[] {
  const items: DocItem[] = [
    ...d.docs.map((doc, i) => ({ kind: 'upload' as const, doc, position: doc.position ?? i })),
    ...(d.written ?? []).map((doc) => ({ kind: 'written' as const, doc, position: doc.position })),
  ]
  return items.sort((a, b) => a.position - b.position || (a.kind === 'upload' ? -1 : 1))
}

export const docCount = (d: Pick<TplDraft, 'docs' | 'written'>) => d.docs.length + (d.written?.length ?? 0)

export function nextPosition(d: Pick<TplDraft, 'docs' | 'written'>) {
  return docItems(d).reduce((m, x) => Math.max(m, x.position + 1), 0)
}

/** Positions 0..n-1 in the current order (what gets saved). */
export function normalizePositions(d: TplDraft): TplDraft {
  const order = docItems(d)
  const pos = new Map(order.map((x, i) => [x.doc.id, i]))
  return {
    ...d,
    docs: d.docs.map((x) => ({ ...x, position: pos.get(x.id) })),
    written: (d.written ?? []).map((x) => ({ ...x, position: pos.get(x.id)! })),
  }
}

export function removeWritten(d: TplDraft, id: string): TplDraft {
  return { ...d, written: (d.written ?? []).filter((w) => w.id !== id) }
}

/* ------------------------------------------------------------------------- */
/* Preview                                                                    */
/* ------------------------------------------------------------------------- */

async function hash(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf).slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('')
}

export class PreviewProblem extends Error {}

/**
 * The PDF a written document becomes, as a document the page viewer can draw.
 * With `tags` (a template with no record) every tag prints as [Label] and
 * every section shows; with `values` it's what that record gets.
 */
export async function renderPreview(input: {
  name: string
  content: LexicalJson
  values?: Record<string, string | null | undefined>
  tags?: Record<string, string>
  roles?: Record<string, string>
  /** The send sheet's preview: values underlined in lilac, empty ones as [Label] (labels by key). */
  highlight?: Record<string, string>
  /** With highlight: empty values' [Label] in red (the template editor's preview). */
  empty?: 'red'
}): Promise<TplDoc> {
  const body = JSON.stringify({
    name: input.name,
    content: input.content,
    values: input.values ?? {},
    tags: input.tags ?? null,
    roles: input.roles ?? {},
    ...(input.highlight ? { highlight: input.highlight } : null),
    ...(input.empty ? { empty: input.empty } : null),
  })
  const key = `written:${await hash(body)}`
  const { data: s } = await supabase.auth.getSession()
  const res = await fetch(`${supabaseUrl}/functions/v1/sign-written-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${s.session?.access_token ?? supabaseAnonKey}`,
    },
    body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new PreviewProblem(err?.message ?? 'The preview couldn’t be made. Try again.')
  }
  const file = await res.blob()
  const doc: TplDoc = { id: key, name: input.name, storage_path: key, page_count: 0, page_sizes: [], size_bytes: file.size, sha256: null, file }
  const pdf = await loadTemplatePdf(doc)
  doc.page_count = pdf.numPages
  doc.page_sizes = Array.from({ length: pdf.numPages }, () => ({ w: 612, h: 792 }))
  return doc
}

/** The preview as a query: refreshed when the text, values or labels change. */
export function useWrittenPreview(
  input: Parameters<typeof renderPreview>[0] | null,
  /** keep: the last pages stay up while the next render comes (the page rail). */
  opts: { enabled?: boolean; keep?: boolean } = {},
) {
  return useQuery({
    queryKey: ['sign', 'written-preview', input ? JSON.stringify(input) : null],
    enabled: !!input && opts.enabled !== false,
    placeholderData: opts.keep ? keepPreviousData : undefined,
    queryFn: () => renderPreview(input!),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
