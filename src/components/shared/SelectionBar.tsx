import * as React from 'react'
import { IconTip } from '@/components/ui/tooltip'
import { Check, MoreHorizontal, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { confirmDestructive, type DestructiveOptions } from '@/components/ui/confirm-dialog'
import { floatingLayerOpen } from '@/lib/floatingLayer'
import { useIsMobile } from '@/hooks/use-mobile'

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
  /**
   * Block B §16 Pattern 3: ask with the bulk delete dialog before `onClick` runs.
   * Put the count in `title` and `confirmLabel`, and the selected names in `items`.
   */
  confirm?: DestructiveOptions
  disabled?: boolean
  /**
   * Wraps the rendered pill — used when the action opens a popover and needs
   * its own trigger. Receives the styled pill.
   */
  render?: (pill: React.ReactNode) => React.ReactNode
  /**
   * Overflow only: a popover the row opens once the menu has closed, anchored to
   * the ⋯ button (the menu row itself is gone by then). Pass `anchor` as the
   * popover's trigger and drive it with `open` / `onOpenChange`.
   */
  panel?: (p: { open: boolean; onOpenChange: (open: boolean) => void; anchor: React.ReactElement }) => React.ReactNode
  /** Overflow only: a submenu of these rows (ends in the §19 chevron). */
  children?: SelectionAction[]
  /** Leading colour dot instead of an icon (stages). */
  dot?: string
  /** The chosen option: a tick at the row's end. */
  checked?: boolean
  /** Faint hint or count at the row's end. */
  hint?: string
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
  minWidth: 0,
  alignItems: 'center',
  gap: 6,
  padding: '6px 11px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  background: 'transparent',
}

/**
 * The floating bulk-action bar. Fixed over the content area (centred on it, not on
 * the window, so the rail doesn't push it off-centre); ticking a row costs zero
 * layout, the table never moves. §8: rises 8px + fades in over --dur-dialog-in, and
 * sinks back out over --dur-dialog-out, still showing the last count while it leaves.
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
  const confirming = React.useRef(false)
  // The overflow row whose popover is open (see SelectionAction.panel).
  const [openPanel, setOpenPanel] = React.useState<string | null>(null)
  const panelPending = React.useRef<string | null>(null)
  // Phones have no room for a submenu beside the menu: its rows list inline.
  const isPhone = useIsMobile()
  // Keep rendering through the exit, with the count it had when it started leaving.
  const [present, setPresent] = React.useState(count > 0)
  const lastCount = React.useRef(count)
  if (count > 0) lastCount.current = count

  React.useEffect(() => {
    if (count > 0) {
      setPresent(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)))
      return () => cancelAnimationFrame(raf)
    }
    setMounted(false)
    const timer = setTimeout(() => setPresent(false), 200)
    return () => clearTimeout(timer)
  }, [count > 0])

  React.useEffect(() => {
    if (count === 0) return
    const onKey = (e: KeyboardEvent) => {
      // Esc in the confirm dialog closes the dialog, not the selection.
      if (e.key === 'Escape' && !confirming.current && !floatingLayerOpen()) onClear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, onClear])

  if (count === 0 && !present) return null
  const shownCount = count > 0 ? count : lastCount.current

  const run = async (action: SelectionAction) => {
    if (action.confirm) {
      confirming.current = true
      const ok = await confirmDestructive(action.confirm)
      // Let the Esc keydown that closed the dialog pass before re-arming.
      window.setTimeout(() => (confirming.current = false), 0)
      if (!ok) return
    }
    action.onClick?.()
  }

  const primary = actions.find((a) => a.slot === 'primary')
  const secondary = actions.filter((a) => a.slot === 'secondary').slice(0, 2)
  const overflow = actions.filter((a) => a.slot === 'overflow' || !a.slot)

  const renderPill = (action: SelectionAction, kind: 'primary' | 'secondary') => {
    const Icon = action.icon
    // Phones keep the bar on screen: a secondary action with an icon shows just the icon.
    const iconOnly = isPhone && kind === 'secondary' && !!Icon
    const pill = (
      <button
        type="button"
        onClick={action.onClick || action.confirm ? () => void run(action) : undefined}
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
        {Icon && <Icon size={12} strokeWidth={kind === 'primary' ? 2.4 : 2} style={{ flex: 'none' }} />}
        {!iconOnly && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{action.label}</span>}
      </button>
    )
    const tipped = iconOnly && !action.render ? <IconTip label={action.label} side="top">{pill}</IconTip> : pill
    return (
      <React.Fragment key={action.id}>
        {action.render ? action.render(pill) : tipped}
      </React.Fragment>
    )
  }

  const roundBtn: React.CSSProperties = {
    width: 26,
    flex: 'none',
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

  // §19 rows: leading icon (or colour dot), truncating label, hint / tick / chevron
  // at the end; danger rows sit last after a divider.
  const menuRow = (a: SelectionAction): React.ReactNode => {
    const lead = a.dot ? (
      <span data-menu-lead>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: a.dot }} />
      </span>
    ) : a.icon ? (
      <a.icon />
    ) : null
    if (a.children?.length && isPhone) {
      return (
        <React.Fragment key={a.id}>
          <DropdownMenuLabel>{a.label}</DropdownMenuLabel>
          {a.children.map(menuRow)}
          <DropdownMenuSeparator />
        </React.Fragment>
      )
    }
    if (a.children?.length) {
      return (
        <DropdownMenuSub key={a.id}>
          <DropdownMenuSubTrigger disabled={busy || a.disabled}>
            {lead}
            <span className="truncate">{a.label}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[220px]">{menuRows(a.children)}</DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }
    const item = (
      <DropdownMenuItem
        key={a.id}
        disabled={busy || a.disabled}
        className={a.destructive ? 'text-destructive' : undefined}
        onSelect={(e) => {
          if (a.render) e.preventDefault()
          if (a.panel) {
            panelPending.current = a.id
            return
          }
          void run(a)
        }}
      >
        {lead}
        <span className="truncate">{a.label}</span>
        {a.hint && <DropdownMenuShortcut>{a.hint}</DropdownMenuShortcut>}
        {a.checked && (
          <span className="gio-mrow-check" aria-hidden>
            <Check className="h-4 w-4" strokeWidth={2} />
          </span>
        )}
      </DropdownMenuItem>
    )
    return a.render ? <React.Fragment key={a.id}>{a.render(item)}</React.Fragment> : item
  }
  const menuRows = (rows: SelectionAction[]) => {
    const calm = rows.filter((a) => !a.destructive)
    const danger = rows.filter((a) => a.destructive)
    return (
      <>
        {calm.map(menuRow)}
        {calm.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map(menuRow)}
      </>
    )
  }

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={`${shownCount} selected`}
      aria-hidden={count === 0 || undefined}
      className={cn('pointer-events-auto sm:[--selection-bar-offset:2.75rem]', className)}
      style={{
        position: 'fixed',
        left: 'calc(50% + var(--selection-bar-offset, 0px))',
        bottom: 28,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        maxWidth: 'calc(100vw - 16px)',
        padding: '9px 10px 9px 16px',
        borderRadius: 999,
        background: '#0d0d09',
        color: '#fffcf9',
        boxShadow: '0 12px 30px rgba(13,13,9,0.28)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translate(-50%, 0)' : 'translate(-50%, 8px)',
        pointerEvents: count === 0 ? 'none' : undefined,
        transition: mounted
          ? 'opacity var(--dur-dialog-in) var(--ease-out), transform var(--dur-dialog-in) var(--ease-out)'
          : 'opacity var(--dur-dialog-out) var(--ease-out), transform var(--dur-dialog-out) var(--ease-out)',
      }}
    >
      <span style={{ fontFamily: inter, fontSize: 12.5, color: '#fffcf9', whiteSpace: 'nowrap', flex: 'none' }}>
        <span style={{ fontWeight: 600 }}>{shownCount}</span> selected
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
        <span style={{ position: 'relative', display: 'inline-flex' }}>
        <DropdownMenu>
          <IconTip label="More bulk actions" side="top">
          <DropdownMenuTrigger asChild>
            <button type="button" style={roundBtn} aria-label="More bulk actions" disabled={busy}>
              <MoreHorizontal size={13} />
            </button>
          </DropdownMenuTrigger>
          </IconTip>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            className="min-w-[272px]"
            // A row's popover opens once the menu has fully closed, and focus doesn't
            // return to the ⋯ button, or the popover would read it as a click outside.
            onCloseAutoFocus={(e) => {
              const id = panelPending.current
              if (!id) return
              e.preventDefault()
              panelPending.current = null
              requestAnimationFrame(() => setOpenPanel(id))
            }}
          >
            {menuRows(overflow)}
          </DropdownMenuContent>
        </DropdownMenu>
        {overflow.filter((a) => a.panel).map((a) => (
          <React.Fragment key={a.id}>
            {a.panel!({
              open: openPanel === a.id,
              onOpenChange: (o) => setOpenPanel(o ? a.id : null),
              anchor: <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />,
            })}
          </React.Fragment>
        ))}
        </span>
      )}

      <IconTip label="Clear selection" side="top">
      <button type="button" onClick={onClear} style={roundBtn} aria-label="Clear selection">
        <X size={13} strokeWidth={2.2} />
      </button>
      </IconTip>
    </div>
  )
}

export default SelectionBar
