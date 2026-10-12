import { formatDistanceToNowStrict } from 'date-fns'

/**
 * Where a candidate's field came from (Find Phase 3, 2026-10-12). The
 * database keeps it in candidates.field_provenance: one entry per field,
 * written by a trigger on every change, so the profile can say "Apollo ·
 * 3 months ago" or "Edited by Ana · 2 days ago".
 */
export type ProvenanceSource =
  | 'person' | 'apollo' | 'apollo_preview' | 'resume' | 'application' | 'extension'
  | 'pdl' | 'import' | 'coresignal' | 'merge' | 'system' | 'unknown'

export interface FieldProvenanceEntry {
  src: ProvenanceSource
  /** When the value was set (ISO). */
  at?: string
  /** Who set it, when a person did (or triggered it). */
  by?: string
  /** When a source last confirmed the value unchanged (ISO). */
  checked?: string
}

export type FieldProvenance = Record<string, FieldProvenanceEntry>

const SOURCE_LABEL: Record<ProvenanceSource, string> = {
  person: 'Edited',
  apollo: 'Apollo',
  apollo_preview: 'Apollo search',
  resume: 'Résumé',
  application: 'Application',
  extension: 'LinkedIn, via the extension',
  pdl: 'People Data Labs',
  import: 'Import',
  coresignal: 'CoreSignal',
  merge: 'Merge',
  system: 'Gio',
  unknown: 'Source not recorded',
}

export function sourceLabel(src: ProvenanceSource | string | undefined): string {
  return SOURCE_LABEL[(src as ProvenanceSource) ?? 'unknown'] ?? SOURCE_LABEL.unknown
}

export function asProvenance(value: unknown): FieldProvenance {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as FieldProvenance) : {}
}

/** The newer of "set" and "checked": how current the value is known to be. */
export function lastKnown(entry: FieldProvenanceEntry | undefined): Date | null {
  if (!entry) return null
  const times = [entry.at, entry.checked].filter(Boolean).map((t) => new Date(t as string).getTime()).filter((n) => !Number.isNaN(n))
  return times.length ? new Date(Math.max(...times)) : null
}

/** "3 months ago", "today". */
export function ageLabel(date: Date | null): string | null {
  if (!date) return null
  if (Date.now() - date.getTime() < 24 * 60 * 60 * 1000) return 'today'
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

/** The entry for a group of fields (location = city, state, country): the newest one. */
export function newestEntry(prov: FieldProvenance, fields: string[]): FieldProvenanceEntry | undefined {
  let best: FieldProvenanceEntry | undefined
  let bestAt = -Infinity
  for (const f of fields) {
    const e = prov[f]
    if (!e) continue
    const t = lastKnown(e)?.getTime() ?? -Infinity
    if (!best || t > bestAt) { best = e; bestAt = t }
  }
  return best
}

/** Older than this, a value is shown as possibly out of date. */
export const STALE_AFTER_DAYS = 180

export function isStale(date: Date | null): boolean {
  return !!date && Date.now() - date.getTime() > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
}
