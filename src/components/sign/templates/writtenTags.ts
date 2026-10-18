import { useMemo } from 'react'

import { COMMON_TAGS, DATA_TAGS, useOfferFormTags, type OfferFormTag, type TplDraft } from '@/lib/sign/templates'
import type { LexicalJson } from '@/lib/sign/written'

/** A value a written document can use; `tag` is set for the linked form's fields. */
export type Tag = { key: string; label: string; type: string; tag?: OfferFormTag }

/** Every value the document can use: the template type's own, then the linked form's. */
export function useWrittenTags(d: Pick<TplDraft, 'kind' | 'offer_form_id'>): Tag[] {
  const formTags = useOfferFormTags(d.kind === 'candidate' ? d.offer_form_id : null)
  return useMemo(() => {
    const std: Tag[] = [...DATA_TAGS[d.kind], ...COMMON_TAGS].map(([key, label]) => ({ key, label, type: key === 'today' || key === 'start' ? 'date' : key === 'salary' ? 'salary' : 'text' }))
    const seen = new Set(std.map((t) => t.key))
    return [...std, ...(formTags.data ?? []).filter((t) => !seen.has(t.key)).map((t) => ({ key: t.key, label: t.label, type: t.type, tag: t }))]
  }, [d.kind, formTags.data])
}

/**
 * What the written preview is made from: the sample offer's values (formatted
 * ones too, highlighted, empty ones in red), or [Labels] with no offer to use.
 * The Preview and the page rail build it the same way, so they share a render.
 */
export function writtenPreviewInput(
  doc: { name: string; content: LexicalJson },
  roles: Pick<TplDraft, 'roles'>['roles'],
  tags: Tag[],
  sample: { values: Record<string, string | null> } | null,
) {
  const byKey = Object.fromEntries(tags.map((t) => [t.key, t.label]))
  return {
    name: doc.name.trim() || 'Untitled document',
    content: doc.content,
    roles: Object.fromEntries(roles.map((r) => [r.id, r.label || 'Signer'])),
    ...(sample ? { values: sample.values, highlight: byKey, empty: 'red' as const } : { tags: byKey }),
  }
}

/** [key, format] for every tag printed in a format (the sample's variants). */
export function formatUses(content: LexicalJson | null | undefined): [string, string][] {
  const out = new Map<string, [string, string]>()
  const walk = (n: Record<string, unknown> | undefined) => {
    if (!n) return
    if (n.type === 'placeholder' && typeof n.format === 'string' && n.placeholderKey) out.set(`${n.placeholderKey}|${n.format}`, [String(n.placeholderKey), n.format])
    for (const k of (n.children as Record<string, unknown>[] | undefined) ?? []) walk(k)
  }
  walk(content?.root as Record<string, unknown>)
  return [...out.values()]
}

