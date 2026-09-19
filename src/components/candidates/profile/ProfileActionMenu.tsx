import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'

/**
 * One home per action.
 *
 * The hero rows carry identity, status and navigation only — every remaining
 * action that has no natural surface of its own lives in this menu. Items that
 * DO have a surface (the stage stepper, the Scorecards card, the references
 * card) appear here with a hint that points back at it, so the menu reads as a
 * shortcut rather than a rival copy of the same action.
 */

export interface ActionMenuItem {
  id: string
  label: string
  icon: LucideIcon
  /** Right-aligned pointer back to the surface that owns this action. */
  hint?: string
  danger?: boolean
  onClick?: () => void
  disabled?: boolean
}

export interface ActionMenuSection {
  /** Optional uppercase section label. */
  label?: string
  items: ActionMenuItem[]
}

interface ProfileActionMenuProps {
  sections: ActionMenuSection[]
  /** Square trigger size — matches the prev/next chevrons beside it. */
  size?: number
}

export function ProfileActionMenu({ sections, size = 32 }: ProfileActionMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = sections
    .map((s) => ({ ...s, items: s.items.filter(Boolean) }))
    .filter((s) => s.items.length > 0)

  if (!visible.length) return null

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        title="More actions"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-lg border border-[#E7E8EE] text-[#5A6072] transition-colors hover:bg-[#F6F5F1]"
        style={{ height: size, width: size, background: open ? '#F6F5F1' : '#fff' }}
      >
        <MoreHorizontal style={{ height: 15, width: 15 }} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute text-left"
          style={{
            top: size + 6,
            right: 0,
            zIndex: 90,
            width: 252,
            background: '#fff',
            border: '1px solid #E7E8EE',
            borderRadius: 12,
            padding: 6,
            boxShadow: '0 18px 44px -12px rgba(13,13,9,0.22), 0 2px 6px rgba(13,13,9,0.05)',
          }}
        >
          {visible.map((section, si) => (
            <div
              key={section.label || si}
              style={
                si === 0
                  ? undefined
                  : { marginTop: 6, paddingTop: 6, borderTop: '1px solid #F1F0EC' }
              }
            >
              {section.label && (
                <div
                  className="font-inter uppercase"
                  style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#B9B7AC', padding: '2px 10px 5px' }}
                >
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false)
                      item.onClick?.()
                    }}
                    className={
                      'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] transition-colors disabled:opacity-40 ' +
                      (item.danger ? 'hover:bg-[#FFF5F5]' : 'hover:bg-[#F6F5F1]')
                    }
                  >
                    <Icon
                      className="shrink-0"
                      style={{ height: 14, width: 14, color: item.danger ? '#C92A2A' : '#5A6072' }}
                      strokeWidth={2}
                    />
                    <span
                      className="font-inter flex-1 min-w-0 truncate text-left"
                      style={{ fontSize: 12.5, fontWeight: 500, color: item.danger ? '#C92A2A' : '#1F2230' }}
                    >
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="font-inter shrink-0" style={{ fontSize: 10.5, color: '#B9B7AC' }}>
                        {item.hint}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProfileActionMenu
