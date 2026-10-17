/**
 * The stored name of an offer form field (2026-10-17). It is the key the
 * offer's values are saved under and the tag an agreement template fills in
 * (sign_fields.data_key: lowercase letters and underscores, up to 40), so it
 * is built to always fit that: accents folded, digits and symbols dropped,
 * never one of the standard agreement values, and unique on the form.
 */
const RESERVED = new Set(['name', 'job', 'salary', 'start', 'today', 'sender'])

export function offerFieldName(label: string, taken: Iterable<string> = []): string {
  const used = new Set(taken)
  let base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/, '')
  if (!base) base = 'field'
  if (RESERVED.has(base)) base = `offer_${base}`
  if (!used.has(base)) return base
  // bonus_b, bonus_c, ... then bonus_aa, bonus_ab, ...
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const suffixes = [...letters.slice(1), ...[...letters].flatMap((x) => [...letters].map((y) => x + y))]
  for (const suffix of suffixes) {
    const name = `${base.slice(0, 40 - suffix.length - 1).replace(/_+$/, '')}_${suffix}`
    if (!used.has(name)) return name
  }
  return base
}
