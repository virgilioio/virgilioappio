import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { menuItem, menuPanel, menuSeparator } from '@/lib/menu-classes'

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
      data-state="open"
      className={cn(
        'absolute right-[3px] z-40 w-[220px]',
        'top' in placement ? 'origin-top-right' : 'origin-bottom-right',
        menuPanel,
      )}
      style={placement}
    >
      {rendered.map((item, i) => {
        const showSeparator = !!item.separatorBefore && i > 0
        return (
          <div key={`${item.action}-${item.label}`}>
            {showSeparator && <div aria-hidden className={menuSeparator} />}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose()
                onSelect(item.action)
              }}
              className={cn(menuItem, 'hover:bg-[hsl(var(--menu-hover))]', item.danger && 'text-destructive')}
            >
              <item.Icon aria-hidden />
              <span className="truncate">{item.label}</span>
            </button>
          </div>
        )
      })}
      {note && (
        <>
          <div aria-hidden className={menuSeparator} />
          <div className="px-2 py-1 font-inter text-[12px] leading-5 text-[hsl(var(--menu-group-color))]">{note}</div>
        </>
      )}
    </div>
  )
}
