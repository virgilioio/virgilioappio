import { useEffect, useLayoutEffect, useRef, useState } from 'react'

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
  danger?: boolean
  dividerBefore?: boolean
}

/**
 * Small anchored menu for a calendar event. Flips above the anchor when it
 * would overflow the bottom of the grid.
 */
export function EventMenu({
  anchor,
  containerEl,
  items,
  note,
  onSelect,
  onClose,
}: {
  anchor: { top: number; bottom: number; left: number; right: number }
  containerEl: HTMLElement | null
  items: EventMenuItem[]
  note?: string
  onSelect: (action: EventMenuAction) => void
  onClose: () => void
}) {
  const WIDTH = 208
  const GAP = 6
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const containerW = containerEl?.clientWidth ?? 800
    const containerH = containerEl?.clientHeight ?? 600
    const h = ref.current?.offsetHeight ?? 200

    let left = Math.min(anchor.right - WIDTH, containerW - WIDTH - GAP)
    left = Math.max(GAP, left)

    let top = anchor.bottom + GAP
    if (top + h > containerH - GAP) top = Math.max(GAP, anchor.top - GAP - h)

    setPos({ top, left })
  }, [anchor, containerEl, items.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-[55]" onMouseDown={onClose} />
      <div
        ref={ref}
        role="menu"
        className="absolute z-[60] bg-white"
        style={{
          top: pos?.top ?? anchor.bottom,
          left: pos?.left ?? anchor.left,
          width: WIDTH,
          visibility: pos ? 'visible' : 'hidden',
          borderRadius: 10,
          border: '1px solid #E7E8EE',
          boxShadow: '0 12px 32px -8px rgba(13,13,9,0.18)',
          padding: 4,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {items.map(item => (
          <div key={item.action + item.label}>
            {item.dividerBefore && (
              <div style={{ height: 1, background: '#F1F0EC', margin: '4px 6px' }} />
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(item.action)
                onClose()
              }}
              className="flex w-full items-center rounded-md px-2.5 font-inter text-left transition-colors"
              style={{
                height: 30,
                fontSize: 12.5,
                color: item.danger ? '#E03131' : '#1F2230',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = item.danger ? '#FFF1F1' : '#F1F0EC'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {item.label}
            </button>
          </div>
        ))}
        {note && (
          <div
            className="font-inter"
            style={{ fontSize: 10.5, color: '#8B8F9E', padding: '6px 8px 4px', lineHeight: 1.35 }}
          >
            {note}
          </div>
        )}
      </div>
    </>
  )
}
