import { Ear, Flag, GitCompare, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface GioFlag {
  type?: string | null
  title?: string | null
  /** Must state specifics — a generic body means the flag should not have fired. */
  body?: string | null
  detail?: string | null
}

const SPEC: Record<string, { title: string; Icon: LucideIcon; tone: 'orange' | 'lilac' }> = {
  contradiction: { title: 'Contradiction between referees', Icon: GitCompare, tone: 'orange' },
  self_assessment_gap: { title: 'Self-assessment gap', Icon: Scale, tone: 'orange' },
  soft_signal: { title: 'Soft signal', Icon: Ear, tone: 'lilac' },
}

const TONE = {
  orange: { border: '#FDE6C8', tile: '#FEF3C7', fg: '#B45309' },
  lilac: { border: '#EDE4FF', tile: '#EDE4FF', fg: '#6F3FF5' },
}

/** Normalises the stored `flags` payload (array, or a keyed object of counts). */
export function readFlags(raw: unknown): GioFlag[] {
  if (Array.isArray(raw)) return raw as GioFlag[]
  return []
}

/**
 * Each flag in full on the detail page. A flag with no body is NOT rendered —
 * "there may be an inconsistency" is worthless, so we refuse to show it.
 */
export function GioFlagCards({ flags }: { flags: unknown }) {
  const items = readFlags(flags).filter((f) => (f.body ?? f.detail ?? '').trim().length > 0)
  if (items.length === 0) return null

  return (
    <div className="flex flex-col" style={{ gap: 8, marginTop: 14 }}>
      {items.map((f, i) => {
        const spec = SPEC[(f.type ?? '') as string] ?? {
          title: f.title ?? 'Flag',
          Icon: Flag,
          tone: 'orange' as const,
        }
        const tone = TONE[spec.tone]
        const Icon = spec.Icon
        return (
          <div
            key={i}
            className="flex"
            style={{
              gap: 10,
              padding: '11px 13px',
              background: '#fff',
              borderRadius: 9,
              border: `1px solid ${tone.border}`,
            }}
          >
            <span
              className="inline-flex items-center justify-center shrink-0"
              style={{ width: 22, height: 22, borderRadius: 6, background: tone.tile }}
            >
              <Icon size={12} color={tone.fg} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p
                className="font-poppins"
                style={{ fontSize: 12, fontWeight: 600, color: '#1F2230' }}
              >
                {f.title || spec.title}
              </p>
              <p
                className="font-inter"
                style={{ fontSize: 11.5, color: '#5A6072', lineHeight: 1.55, marginTop: 3 }}
              >
                {f.body ?? f.detail}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default GioFlagCards
