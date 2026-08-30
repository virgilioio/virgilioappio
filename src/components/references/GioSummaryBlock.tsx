import { Flag, Sparkles } from 'lucide-react'

export interface GioFlagCounts {
  contradiction?: number | null
  self_assessment_gap?: number | null
  soft_signal?: number | null
}

const FLAG_LABEL: Record<keyof GioFlagCounts, [string, string]> = {
  contradiction: ['contradiction', 'contradictions'],
  self_assessment_gap: ['self-assessment gap', 'self-assessment gaps'],
  soft_signal: ['soft signal', 'soft signals'],
}

/**
 * Gio's read on the answers. Lilac when clean, amber when flagged.
 *
 * There is no analysis layer yet, so with no prose this renders NOTHING — no
 * placeholder, no skeleton, no empty chrome.
 */
export function GioSummaryBlock({
  prose,
  flagged = false,
  flags,
  updatedAt,
  submitted,
  required,
}: {
  prose?: string | null
  flagged?: boolean
  flags?: GioFlagCounts | null
  updatedAt?: string | null
  submitted?: number
  required?: number
}) {
  const text = (prose ?? '').trim()
  if (!text) return null

  const tone = flagged
    ? { bg: '#FFFBF3', border: '#FDE6C8', chip: '#FDE6C8', fg: '#9A3412', icon: Flag }
    : { bg: '#FAF8FF', border: '#EDE4FF', chip: '#EDE4FF', fg: '#5B21B6', icon: Sparkles }
  const Icon = tone.icon

  const badges = (Object.keys(FLAG_LABEL) as Array<keyof GioFlagCounts>)
    .map((key) => ({ key, count: Number(flags?.[key] ?? 0) }))
    .filter((f) => f.count > 0)

  const meta = [
    updatedAt
      ? `Updated ${new Date(updatedAt).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        })}`
      : null,
    typeof submitted === 'number' && typeof required === 'number'
      ? `${submitted} of ${required} in`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <span
          className="inline-flex items-center justify-center shrink-0"
          style={{ width: 22, height: 22, borderRadius: 6, background: tone.chip }}
        >
          <Icon size={12} color={tone.fg} strokeWidth={2.2} />
        </span>
        <span
          className="font-poppins"
          style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', color: '#1F2230' }}
        >
          Gio summary
        </span>
        {meta && (
          <span className="font-inter" style={{ fontSize: 10.5, color: '#8B8F9E' }}>
            {meta}
          </span>
        )}
      </div>

      <p
        className="font-inter"
        style={{ fontSize: 12, color: '#3A3F52', lineHeight: 1.6, marginTop: 8 }}
      >
        {text}
      </p>

      {badges.length > 0 && (
        <div className="flex items-center" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {badges.map(({ key, count }) => (
            <span
              key={key}
              className="font-inter"
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: tone.fg,
                background: tone.chip,
                borderRadius: 999,
                padding: '3px 8px',
              }}
            >
              {count} {FLAG_LABEL[key][count === 1 ? 0 : 1]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default GioSummaryBlock
