import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Motion & Feel §13 unsaved changes. Place it as the last child of a sheet or dialog
 * footer (which must be `relative`). When `open`, it covers the footer in place with
 * "Discard unsaved changes?" plus Keep editing and Discard, fading up 4px over
 * --dur-guard. Focus moves to Keep editing; the footer's own controls are inert
 * meanwhile; Esc keeps editing. Never a second modal, never a browser confirm.
 */
const inert = (on: boolean) => (on ? ({ inert: '' } as Record<string, string>) : {})

export function UnsavedGuard({
  open,
  onKeep,
  onDiscard,
  detail,
  className,
}: {
  open: boolean
  onKeep: () => void
  onDiscard: () => void
  detail?: ReactNode
  className?: string
}) {
  const root = useRef<HTMLDivElement | null>(null)
  const keep = useRef<HTMLButtonElement | null>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    const bar = root.current
    const footer = bar?.parentElement
    if (!bar || !footer) return
    const siblings = Array.from(footer.children).filter((child): child is HTMLElement => child !== bar)
    siblings.forEach((child) => (open ? child.setAttribute('inert', '') : child.removeAttribute('inert')))
    return () => siblings.forEach((child) => child.removeAttribute('inert'))
  }, [open])

  useEffect(() => {
    if (open) {
      const active = document.activeElement
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null
      keep.current?.focus({ preventScroll: true })
      return
    }
    const target = returnTo.current
    returnTo.current = null
    if (target?.isConnected && root.current?.contains(document.activeElement)) target.focus({ preventScroll: true })
  }, [open])

  return (
    <div
      ref={root}
      role="alertdialog"
      aria-modal="false"
      aria-hidden={open ? undefined : true}
      aria-labelledby={open ? titleId : undefined}
      data-open={open || undefined}
      {...inert(!open)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onKeep()
        }
      }}
      className={cn('gio-guard absolute inset-0 flex items-center gap-2.5 bg-background px-6', className)}
    >
      <div className="min-w-0 flex-1">
        <p id={titleId} className="truncate text-[13px] font-medium text-text-primary">
          Discard unsaved changes?
        </p>
        {detail ? <p className="truncate text-[11.5px] text-text-tertiary">{detail}</p> : null}
      </div>
      <Button ref={keep} type="button" variant="secondary" onClick={onKeep}>
        Keep editing
      </Button>
      <Button type="button" variant="danger" onClick={onDiscard}>
        Discard
      </Button>
    </div>
  )
}
