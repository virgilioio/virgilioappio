import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SuspendOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  organizationName: string
  isPending?: boolean
}

/**
 * S28 (Block B §16): a form dialog, so it keeps its required reason but gets the
 * delete-dialog header (round badge, a title that names the workspace, what
 * happens and what stays) and footer (Cancel focused first, red Suspend
 * workspace). Esc and the backdrop wait while it's suspending; the caller closes
 * it once the suspension has gone through.
 */
export function SuspendOrganizationDialog({
  open,
  onOpenChange,
  onConfirm,
  organizationName,
  isPending = false
}: SuspendOrganizationDialogProps) {
  const [reason, setReason] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  const close = () => {
    if (!isPending) onOpenChange(false)
  }

  const handleConfirm = () => {
    if (reason.trim() && !isPending) onConfirm(reason.trim())
  }

  const name = organizationName?.trim() || 'this workspace'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/80 gio-dialog-overlay" />
        <DialogPrimitive.Content
          aria-describedby="suspend-org-desc"
          className={cn(
            'fixed left-[50%] top-[50%] z-[70] [translate:-50%_-50%] w-[min(460px,calc(100vw-32px))]',
            'border bg-background shadow-lg gio-dialog rounded-lg',
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
          onEscapeKeyDown={(e) => {
            if (isPending) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (isPending) e.preventDefault()
          }}
        >
          <div className="flex items-start gap-[14px] px-[22px] pt-[22px] pb-[18px]">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-danger-tint)] text-[var(--color-danger)]"
            >
              <Ban className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">
                Deactivate {name}?
              </DialogPrimitive.Title>
              <p id="suspend-org-desc" className="mt-1 text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                Everyone in {name} loses access right away and sees a locked workspace. Their jobs, candidates and
                billing history are kept. To let them back in later, reactivate the workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 px-[22px] pb-[18px]">
            <Label htmlFor="suspend-reason" className="text-[12px] font-medium text-text-secondary">
              Reason for deactivating
            </Label>
            <Textarea
              id="suspend-reason"
              placeholder="For example: repeated chargebacks on the card on file"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={isPending}
            />
            <p className="text-[12px] text-text-secondary">Platform admins see this reason on the customer’s page.</p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-virgilio-border px-[22px] py-[14px]">
            <Button ref={cancelRef} variant="secondary" size="sm" disabled={isPending} onClick={close}>
              Cancel
            </Button>
            <Button
              variant="dangerSolid"
              size="sm"
              loading={isPending}
              disabled={!reason.trim()}
              onClick={handleConfirm}
            >
              Deactivate workspace
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
