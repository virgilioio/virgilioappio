import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TemplatePreview } from '@/components/editors'

/**
 * Settings › Templates › Preview (2026-11-18): an email or rejection template
 * as a candidate would get it, with sample values, without opening the editor.
 * The same preview the editor shows (TemplatePreview).
 */
export function TemplatePreviewDialog({
  template,
  onClose,
  onEdit,
}: {
  /** The template to show; null keeps the dialog closed. */
  template: { name: string; subject: string; body: string } | null
  onClose: () => void
  onEdit: () => void
}) {
  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="line-clamp-2 break-words">{template?.name}</DialogTitle>
          <DialogDescription>How the email reads when it goes out.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {template && <TemplatePreview subject={template.subject} body={template.body} minHeight={160} />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" icon={Pencil} onClick={onEdit}>
            Edit template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
