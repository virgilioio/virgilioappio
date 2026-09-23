import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'

export type EventMenuAction =
  | 'reschedule'
  | 'resend'
  | 'copy-link'
  | 'view-candidate'
  | 'cancel'
  | 'confirm'
  | 'release'
  | 'rebook'
  | 'open-google'
  | 'open-notes'

export interface EventMenuItem {
  action: EventMenuAction
  label: string
  Icon: LucideIcon
  danger?: boolean
  separatorBefore?: boolean
}

/**
 * Event action menu. Rendered inside the day column so it scrolls with the
 * grid; vertical placement is supplied by the caller (flips above for events
 * late in the day).
 */
export function EventMenu({
  placement,
  items,
  note,
  onSelect,
  onClose,
}: {
  placement: { top: number } | { bottom: number }
  items: EventMenuItem[]
  note?: string
  onSelect: (action: EventMenuAction) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose()
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Never render two separators in a row, or one first / last.
  const rendered = items.filter(Boolean)

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'absolute',
        right: 3,
        width: 208,
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 14px 32px -10px rgba(13,13,9,0.28)',
        zIndex: 40,
        ...placement,
      }}
    >
      {rendered.map((item, i) => {
        const showSeparator = !!item.separatorBefore && i > 0
        return (
          <div key={`${item.action}-${item.label}`}>
            {showSeparator && (
              <div style={{ height: 1, background: '#F1F0EC', margin: '4px 2px' }} />
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose()
                onSelect(item.action)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                width: '100%',
                height: 30,
                padding: '0 9px',
                border: 'none',
                borderRadius: 7,
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: 12,
                color: item.danger ? '#E03131' : '#1F2230',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = item.danger ? '#FFF1F1' : '#F6F5F1'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <item.Icon size={13} strokeWidth={2} color={item.danger ? '#E03131' : '#8B8F9E'} />
              {item.label}
            </button>
          </div>
        )
      })}
      {note && (
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: 10.5,
            lineHeight: 1.45,
            color: '#8B8F9E',
            padding: '4px 9px 6px',
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}
