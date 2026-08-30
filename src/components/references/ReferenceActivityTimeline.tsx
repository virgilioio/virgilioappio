import {
  Ban,
  Flag,
  MailX,
  Pause,
  Send,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { ReferenceActivityRow } from '@/hooks/useReferenceList'

interface Tone {
  color: string
  Icon: LucideIcon
}

/** Event → tone + glyph. Unknown types fall back to the neutral send tone. */
function toneFor(type: string): Tone {
  const t = type.toLowerCase()
  if (t.includes('gio') || t.includes('summary')) return { color: '#6F3FF5', Icon: Sparkles }
  if (t.includes('bounce')) return { color: '#FA5252', Icon: MailX }
  if (t.includes('declin') || t.includes('cancel')) return { color: '#FA5252', Icon: Ban }
  if (t.includes('hold')) return { color: '#F97316', Icon: Pause }
  if (t.includes('flag')) return { color: '#F97316', Icon: Flag }
  if (t.includes('submit') || t.includes('consent') || t.includes('logged'))
    return { color: '#12B886', Icon: UserRoundCheck }
  return { color: '#0EA5E9', Icon: Send }
}

function when(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(
    undefined,
    { hour: '2-digit', minute: '2-digit' },
  )}`
}

function humanise(type: string) {
  return type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/** Every state transition, oldest first. Never truncated, never behind a toggle. */
export function ReferenceActivityTimeline({ activity }: { activity: ReferenceActivityRow[] }) {
  if (activity.length === 0) return null

  return (
    <div>
      {activity.map((a, i) => {
        const { color, Icon } = toneFor(a.type)
        const last = i === activity.length - 1
        return (
          <div
            key={a.id}
            className="flex"
            style={{ gap: 11, paddingBottom: last ? 0 : 14, position: 'relative' }}
          >
            {!last && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 11,
                  top: 24,
                  bottom: 0,
                  width: 1,
                  background: '#F1F0EC',
                }}
              />
            )}
            <span
              className="inline-flex items-center justify-center shrink-0"
              style={{
                width: 23,
                height: 23,
                borderRadius: 999,
                background: `${color}18`,
                zIndex: 1,
              }}
            >
              <Icon size={12} color={color} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p
                className="font-inter"
                style={{ fontSize: 12, color: '#1F2230', lineHeight: 1.45 }}
              >
                {a.label || humanise(a.type)}
              </p>
              <p className="font-inter" style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 2 }}>
                {[a.actorName ?? 'System', when(a.created_at)].join(' · ')}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ReferenceActivityTimeline
