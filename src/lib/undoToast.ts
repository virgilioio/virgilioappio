import { toast } from 'sonner'

/**
 * "{Name} archived · Undo" (Block B §16 / §5, 2026-10-13). One Sonner toast,
 * bottom-left, with Undo in its action; it lasts as long as toasts do and the
 * timer pauses on hover. Only for actions that can really be reversed (archive,
 * soft delete, status change, dismissal) — never after a hard delete.
 */
export function undoToast(message: string, onUndo: () => void | Promise<void>, description?: string) {
  return toast(message, {
    description,
    action: { label: 'Undo', onClick: () => void onUndo() },
  })
}
