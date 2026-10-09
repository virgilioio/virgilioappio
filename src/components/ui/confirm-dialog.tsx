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

/**
 * Motion & Feel §5 / Allan 2026-10-09: the app's confirmation dialog, replacing the
 * browser's confirm() box. One host is mounted in App.tsx; anywhere can await it:
 *
 *   if (!(await confirmDialog({ title: 'Delete this comment?', confirmLabel: 'Delete', destructive: true }))) return
 *
 * Focus starts on Cancel; Esc and the overlay cancel. It uses the shared AlertDialog
 * (gio-dialog motion), never a second modal on top of one that's already open.
 */
export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
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

export function ConfirmDialogHost() {
  const [queue, setQueue] = React.useState<Request[]>([])
  const [open, setOpen] = React.useState(false)
  const current = queue[0]
  const cancelRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r])
    return () => {
      enqueue = null
    }
  }, [])
  React.useEffect(() => {
    if (current) setOpen(true)
  }, [current])

  const settle = (ok: boolean) => {
    if (!current) return
    current.resolve(ok)
    setOpen(false)
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
            <Button variant={current.destructive ? 'dangerSolid' : 'primary'} onClick={() => settle(true)}>
              {current.confirmLabel ?? 'Continue'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
