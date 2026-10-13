import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { Archive, Ban, Trash2, UserMinus, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { prefersReducedMotion, motionToken } from '@/lib/motion'

/**
 * ConfirmDestructiveDialog — Block B §16 (2026-10-13). The one dialog for every
 * delete, remove and archive confirmation in the ATS. Three patterns:
 *
 *  - Single item: name the thing, say what goes and what stays, Cancel has focus.
 *    The dialog closes at once and `onConfirm` runs (the caller collapses the row).
 *  - Type to confirm (`typeToConfirm`): high-impact permanent deletes. The red
 *    button stays disabled until the exact name is typed; a wrong Enter nudges the
 *    field. While deleting the button keeps its width with a spinner, and Esc,
 *    the backdrop and Cancel are blocked; the dialog closes only when `onConfirm`
 *    resolves, and shows the error inline if it throws.
 *  - Bulk (`items`): the count is in the title and button; up to 3 names as chips.
 *
 * `variant: 'blocked'` explains why something can't be deleted and swaps the red
 * button for the action that fixes it (`confirmLabel` + `onConfirm`), or none.
 *
 * Built on Radix AlertDialog with the shared gio-dialog motion (220ms in, 150ms
 * out, from 0.96). The backdrop cancels, like Esc.
 */
export type DestructiveVariant = 'delete' | 'remove' | 'archive' | 'blocked'

export interface ConfirmDestructiveProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant?: DestructiveVariant
  icon?: LucideIcon
  /** Names the thing: "Delete Priya Raman?" — never "Are you sure?". */
  title: string
  /** What is lost and what stays. */
  description?: React.ReactNode
  /** Verb + object: "Delete candidate", "Archive job". Required. */
  confirmLabel: string
  cancelLabel?: string
  onConfirm?: () => void | Promise<void>
  /** Exact name to type before the red button enables (Pattern 2). */
  typeToConfirm?: string
  /** Names for a bulk delete (Pattern 3): 3 chips, then "+N more". */
  items?: string[]
  /** How many are selected when `items` holds only the first few names. */
  itemsTotal?: number
  /** Extra content under the description (rare). */
  children?: React.ReactNode
}

const ICONS: Record<DestructiveVariant, LucideIcon> = {
  delete: Trash2,
  remove: UserMinus,
  archive: Archive,
  blocked: Ban,
}

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  variant = 'delete',
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  typeToConfirm,
  items,
  itemsTotal,
  children,
}: ConfirmDestructiveProps) {
  const Icon = icon ?? ICONS[variant]
  const blocked = variant === 'blocked'
  const waitForSuccess = !!typeToConfirm
  const [typed, setTyped] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fieldRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) {
      setTyped('')
      setBusy(false)
      setError(null)
    }
  }, [open])

  const matches = !typeToConfirm || typed.trim() === typeToConfirm.trim()

  const close = () => {
    if (!busy) onOpenChange(false)
  }

  const nudge = () => {
    inputRef.current?.focus()
    if (prefersReducedMotion() || !fieldRef.current?.animate) return
    fieldRef.current.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-4px)', offset: 0.2 },
        { transform: 'translateX(4px)', offset: 0.45 },
        { transform: 'translateX(-2px)', offset: 0.7 },
        { transform: 'translateX(0)' },
      ],
      { duration: motionToken('--dur-nudge', 280), easing: motionToken('--ease-out', 'ease-out') },
    )
  }

  const confirm = async () => {
    if (busy) return
    if (!matches) {
      nudge()
      return
    }
    if (!waitForSuccess) {
      // Confirm first, then close: a caller awaiting the answer sees "yes"
      // before the close reads as a cancel.
      void onConfirm?.()
      onOpenChange(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onConfirm?.()
      setBusy(false)
      onOpenChange(false)
    } catch (e) {
      setBusy(false)
      const msg = e instanceof Error && e.message ? e.message : ''
      setError(msg && msg.length < 160 ? msg : "That didn't go through. Nothing was deleted; try again.")
    }
  }

  const shown = (items ?? []).slice(0, 3)
  const more = Math.max(itemsTotal ?? 0, items?.length ?? 0) - shown.length

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/80 gio-dialog-overlay"
          onClick={close}
        />
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 [translate:-50%_-50%] w-[min(420px,calc(100vw-32px))]',
            'border bg-background shadow-lg gio-dialog rounded-lg',
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(typeToConfirm ? inputRef.current : cancelRef.current)?.focus()
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault()
          }}
        >
          <div className="flex items-start gap-[14px] px-[22px] pt-[22px] pb-[18px]">
            <span
              aria-hidden="true"
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                blocked ? 'bg-[#F1F0EC] text-text-secondary' : 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <AlertDialogPrimitive.Title className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">
                {title}
              </AlertDialogPrimitive.Title>
              {description ? (
                <AlertDialogPrimitive.Description className="mt-1 text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                  {description}
                </AlertDialogPrimitive.Description>
              ) : null}
            </div>
          </div>

          {(shown.length > 0 || typeToConfirm || children) && (
            <div className="flex flex-col gap-2.5 px-[22px] pb-[18px]">
              {shown.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {shown.map((name, i) => (
                    <span key={`${name}-${i}`} className="max-w-[180px] truncate rounded-full bg-[#F4F3EF] px-2.5 py-[3px] text-[12px] font-medium text-text-primary">
                      {name}
                    </span>
                  ))}
                  {more > 0 && (
                    <span className="rounded-full bg-[#F4F3EF] px-2.5 py-[3px] text-[12px] font-medium text-text-secondary">+{more} more</span>
                  )}
                </div>
              )}
              {children}
              {typeToConfirm && (
                <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-secondary">
                  <span>
                    Type <b className="font-semibold text-text-primary">{typeToConfirm}</b> to confirm
                  </span>
                  <div ref={fieldRef}>
                    <Input
                      ref={inputRef}
                      value={typed}
                      readOnly={busy}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={`Type ${typeToConfirm} to confirm`}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void confirm()
                        }
                      }}
                    />
                  </div>
                </label>
              )}
              {waitForSuccess && (
                <p className="min-h-[18px] text-[12px] text-[var(--color-danger)]" role="alert">
                  {error ?? ''}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-virgilio-border px-[22px] py-[14px]">
            <Button ref={cancelRef} variant="secondary" size="sm" disabled={busy} onClick={close}>
              {cancelLabel ?? (blocked ? 'Close' : 'Cancel')}
            </Button>
            {blocked ? (
              onConfirm && confirmLabel ? (
                <Button variant="primary" size="sm" onClick={() => { void onConfirm(); onOpenChange(false) }}>
                  {confirmLabel}
                </Button>
              ) : null
            ) : (
              <Button
                variant="dangerSolid"
                size="sm"
                loading={busy}
                disabled={!matches}
                onClick={() => void confirm()}
                className="transition-opacity duration-[var(--dur-hover)]"
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
