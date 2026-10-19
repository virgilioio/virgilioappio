import type { OfferFormField } from '@/hooks/useOfferFormFields'

/**
 * Offer form sections (Allan, 2026-10-19): each form keeps its own ordered
 * list in `offer_forms.sections`, and each field points at one through
 * `offer_form_fields.section_key`. New forms start with DEFAULT_SECTIONS;
 * every section can be renamed, reordered, given one or two columns, or taken
 * out. The database moves the fields of a removed section into the last one
 * left (`offer_forms_z_sections_moved`), so a field is never lost.
 */
export interface OfferSection {
  id: string
  title: string
  columns: 1 | 2
}

export const DEFAULT_SECTIONS: OfferSection[] = [
  { id: 'role', title: 'Role & start', columns: 2 },
  { id: 'compensation', title: 'Compensation', columns: 1 },
  { id: 'benefits', title: 'Benefits & conditions', columns: 1 },
  { id: 'additional', title: 'Additional terms', columns: 2 },
]

/** The form's sections as stored, tolerating a form read before the column existed. */
export function formSections(form: { sections?: unknown } | null | undefined): OfferSection[] {
  const raw = form?.sections
  if (!Array.isArray(raw)) return DEFAULT_SECTIONS
  return raw
    .filter((s): s is { id: string; title: string; columns?: number } => !!s && typeof s.id === 'string' && typeof s.title === 'string')
    .map((s) => ({ id: s.id, title: s.title, columns: s.columns === 1 ? 1 : 2 }))
}

export function newSectionId(): string {
  return `s_${crypto.randomUUID().slice(0, 8)}`
}

export interface SectionGroup<F> {
  /** null: the form has no sections, so the fields are one plain list. */
  section: OfferSection | null
  fields: F[]
}

/**
 * Fields in their sections, in section order, each section by display_order.
 * A field whose section is gone (or never set) joins the last section, as the
 * database would place it.
 */
export function groupBySection<F extends Pick<OfferFormField, 'display_order'> & { section_key?: string | null }>(
  sections: OfferSection[],
  fields: F[],
): SectionGroup<F>[] {
  const sorted = [...fields].sort((a, b) => a.display_order - b.display_order)
  if (sections.length === 0) return [{ section: null, fields: sorted }]
  const known = new Set(sections.map((s) => s.id))
  const last = sections[sections.length - 1].id
  const keyOf = (f: F) => (f.section_key && known.has(f.section_key) ? f.section_key : last)
  return sections.map((section) => ({ section, fields: sorted.filter((f) => keyOf(f) === section.id) }))
}

/** Fields that take the whole row in a two-column section. */
export function isWideField(field: Pick<OfferFormField, 'field_type'>): boolean {
  return field.field_type === 'textarea' || field.field_type === 'location'
}
