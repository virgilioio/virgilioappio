import * as React from 'react'
import { MoreHorizontal, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const inter = "'Inter', system-ui, sans-serif"
const poppins = "'Poppins', system-ui, sans-serif"

export interface SelectionAction {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  /** Where the action sits: one primary, up to two secondary, rest overflow. */
  slot?: 'primary' | 'secondary' | 'overflow'
  destructive?: boolean
  disabled?: boolean
  /**
   * Wraps the rendered pill — used when the action opens a popover and needs
   * its own trigger. Receives the styled pill.
   */
  render?: (pill: React.ReactNode) => React.ReactNode
}

export interface SelectionBarProps {
  count: number
  actions: SelectionAction[]
  onClear: () => void
  /** Optional "Select all N" extension, shown before the divider. */
  totalCount?: number
  onSelectAll?: () => void
  /** Disables every button while a bulk action runs. The bar never spins. */
  busy?: boolean
  className?: string
}

const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 11px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  background: 'transparent',
}

/**
 * The floating bulk-action bar. Absolutely positioned inside its surface's
 * scroll container so ticking a row costs zero layout — the table never moves.
 */
export function SelectionBar({
  count,
  actions,
  onClear,
  totalCount,
  onSelectAll,
  busy,
  className,
}: SelectionBarProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    if (count > 0) {
      const raf = requestAnimationFrame(() => setMounted(true))
      return () => cancelAnimationFrame(raf)
    }
    setMounted(false)
  }, [count > 0])

  React.useEffect(() => {
    if (count === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, onClear])

  if (count === 0) return null

  const primary = actions.find((a) => a.slot === 'primary')
  const secondary = actions.filter((a) => a.slot === 'secondary').slice(0, 2)
  const overflow = actions.filter((a) => a.slot === 'overflow' || !a.slot)

  const renderPill = (action: SelectionAction, kind: 'primary' | 'secondary') => {
    const Icon = action.icon
    const pill = (
      <button
        type="button"
        onClick={action.onClick}
        disabled={busy || action.disabled}
        aria-label={action.label}
        style={{
          ...pillBase,
          background: kind === 'primary' ? '#fffcf9' : 'transparent',
          color: kind === 'primary' ? '#0d0d09' : '#fffcf9',
          border: kind === 'primary' ? '1px solid #fffcf9' : '1px solid rgba(255,252,249,0.22)',
          fontFamily: kind === 'primary' ? poppins : inter,
          fontSize: 12,
          fontWeight: kind === 'primary' ? 600 : 400,
          opacity: busy || action.disabled ? 0.55 : 1,
        }}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {Icon && <Icon size={12} strokeWidth={kind === 'primary' ? 2.4 : 2} />}
        <span>{action.label}</span>
      </button>
    )
    return (
      <React.Fragment key={action.id}>
        {action.render ? action.render(pill) : pill}
      </React.Fragment>
    )
  }

  const roundBtn: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 0,
    color: 'rgba(255,252,249,0.7)',
    cursor: 'pointer',
    padding: 0,
  }

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={`${count} selected`}
      className={cn('pointer-events-auto', className)}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 28,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px 9px 16px',
        borderRadius: 999,
        background: '#0d0d09',
        color: '#fffcf9',
        boxShadow: '0 12px 30px rgba(13,13,9,0.28)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translate(-50%, 0)' : 'translate(-50%, 8px)',
        transition: mounted
          ? 'opacity 160ms ease-out, transform 160ms ease-out'
          : 'opacity 120ms ease-out, transform 120ms ease-out',
      }}
    >
      <span style={{ fontFamily: inter, fontSize: 12.5, color: '#fffcf9' }}>
        <span style={{ fontWeight: 600 }}>{count}</span> selected
      </span>

      {onSelectAll && typeof totalCount === 'number' && totalCount > count && (
        <button
          type="button"
          onClick={onSelectAll}
          style={{
            background: 'none',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            fontFamily: inter,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#fffcf9',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          Select all {totalCount.toLocaleString()}
        </button>
      )}

      <span style={{ width: 1, height: 18, background: 'rgba(255,252,249,0.2)' }} />

      {primary && renderPill(primary, 'primary')}
      {secondary.map((a) => renderPill(a, 'secondary'))}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" style={roundBtn} aria-label="More bulk actions" disabled={busy}>
              <MoreHorizontal size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" sideOffset={8}>
            {overflow.map((a) => {
              const item = (
                <DropdownMenuItem
                  key={a.id}
                  disabled={busy || a.disabled}
                  onSelect={(e) => {
                    if (a.render) e.preventDefault()
                    a.onClick?.()
                  }}
                  style={a.destructive ? { color: '#FA5252' } : undefined}
                >
                  {a.icon && <a.icon size={13} strokeWidth={2} />}
                  {a.label}
                </DropdownMenuItem>
              )
              return a.render ? (
                <React.Fragment key={a.id}>{a.render(item)}</React.Fragment>
              ) : (
                item
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <button type="button" onClick={onClear} style={roundBtn} title="Clear selection" aria-label="Clear selection">
        <X size={13} strokeWidth={2.2} />
      </button>
    </div>
  )
}

export default SelectionBar
