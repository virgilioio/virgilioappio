import * as React from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDestructiveDialog, type DestructiveVariant } from '@/components/ui/confirm-destructive'
import type { LucideIcon } from 'lucide-react'

/**
 * Motion & Feel §5 / Allan 2026-10-09: the app's confirmation dialog, replacing the
 * browser's confirm() box. One host is mounted in App.tsx; anywhere can await it:
 *
 *   if (!(await confirmDialog({ title: 'Delete this comment?', confirmLabel: 'Delete', destructive: true }))) return
 *
 * Focus starts on Cancel; Esc and the overlay cancel. It uses the shared AlertDialog
 * (gio-dialog motion), never a second modal on top of one that's already open.
 *
 * Block B §16 (2026-10-13): destructive confirmations render the delete-dialog
 * design (ConfirmDestructiveDialog). Use `confirmDestructive()` for them: it
 * requires the verb + object label and takes the variant, type-to-confirm name,
 * bulk names and an `onConfirm` that the dialog waits for (type to confirm only).
 */
export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  variant?: DestructiveVariant
  icon?: LucideIcon
  typeToConfirm?: string
  items?: string[]
  itemsTotal?: number
  /** Type to confirm: the dialog stays open, with a spinner, until this resolves. */
  onConfirm?: () => Promise<void>
}

export interface DestructiveOptions extends Omit<ConfirmOptions, 'destructive' | 'confirmLabel'> {
  confirmLabel: string
}

type Request = ConfirmOptions & { resolve: (ok: boolean) => void }
let enqueue: ((r: Request) => void) | null = null

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (enqueue) enqueue({ ...options, resolve })
    // Host not mounted (shouldn't happen): fall back to the browser so nothing is lost.
    else resolve(window.confirm(options.title))
  })
}

/** A delete, remove or archive confirmation (Block B §16). */
export function confirmDestructive(options: DestructiveOptions): Promise<boolean> {
  return confirmDialog({ ...options, destructive: true, variant: options.variant ?? 'delete' })
}

export function ConfirmDialogHost() {
  const [queue, setQueue] = React.useState<Request[]>([])
  const [open, setOpen] = React.useState(false)
  const current = queue[0]
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const settled = React.useRef(false)

  React.useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r])
    return () => {
      enqueue = null
    }
  }, [])
  React.useEffect(() => {
    if (current) {
      settled.current = false
      setOpen(true)
    }
  }, [current])

  const settle = (ok: boolean) => {
    if (!current || settled.current) return
    settled.current = true
    current.resolve(ok)
    setOpen(false)
  }

  if (current && (current.destructive || current.variant)) {
    return (
      <ConfirmDestructiveDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            settle(false)
            // Drop the request once the exit animation (--dur-dialog-out) is done.
            window.setTimeout(() => setQueue((q) => (q[0] === current ? q.slice(1) : q)), 200)
          }
        }}
        variant={current.variant ?? 'delete'}
        icon={current.icon}
        title={current.title}
        description={current.description}
        confirmLabel={current.confirmLabel ?? 'Delete'}
        cancelLabel={current.cancelLabel}
        typeToConfirm={current.typeToConfirm}
        items={current.items}
        itemsTotal={current.itemsTotal}
        onConfirm={async () => {
          if (current.onConfirm) await current.onConfirm()
          settle(true)
        }}
      />
    )
  }

  return (
    <AlertDialog
      open={open && !!current}
      onOpenChange={(o) => {
        if (!o) settle(false)
      }}
    >
      {current && (
        <AlertDialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
          onAnimationEnd={() => {
            // Drop the settled request once the exit animation has finished.
            if (!open) setQueue((q) => q.slice(1))
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{current.title}</AlertDialogTitle>
            {current.description ? <AlertDialogDescription>{current.description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancelRef} onClick={() => settle(false)}>
              {current.cancelLabel ?? 'Cancel'}
            </AlertDialogCancel>
            <Button variant="primary" onClick={() => settle(true)}>
              {current.confirmLabel ?? 'Continue'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
