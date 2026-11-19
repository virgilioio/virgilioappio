import { useRef, useState } from 'react'
import { Copy, Eye } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { copyName } from '@/lib/copyName'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { undoToast } from '@/lib/undoToast'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates'
import { RejectionEmailTemplateSheet } from './templates/RejectionEmailTemplateSheet'
import { TemplatePreviewDialog } from './templates/TemplatePreviewDialog'
import { LibraryCard } from './shared/LibraryCard'

/**
 * Settings › Templates › Rejection templates (2026-10-19): one list, the
 * shared emails and Virgilio's own together. A deleted template is
 * soft-deleted, so it has Undo. Each row's ⋯ has Edit, Preview, Duplicate
 * and Delete (2026-11-18).
 */
export function RejectionEmailTemplatesManager() {
  const { templates, isLoading, loadError, refetchTemplates, createTemplate, deleteTemplate, restoreTemplate } = useRejectionEmailTemplates('organization')
  const [sheet, setSheet] = useState({ open: false, templateId: undefined as string | undefined })
  const [previewId, setPreviewId] = useState<string | null>(null)
  const previewing = templates.find((t) => t.id === previewId) ?? null
  const copying = useRef(false)

  // The copy is saved at once (with the reason the original is for) and opens in the editor.
  const handleDuplicate = async (t: { name: string; subject: string; body: string; rejection_reason_id: string | null }) => {
    if (copying.current) return
    copying.current = true
    const name = copyName(t.name, templates.map((x) => x.name))
    try {
      const { id } = await createTemplate({ name, subject: t.subject, body: t.body, rejection_reason_id: t.rejection_reason_id }, { quiet: true })
      toast({ title: `${name} created` })
      setSheet({ open: true, templateId: id })
    } catch {
      toast({ title: `Couldn’t duplicate ${t.name}`, description: 'Nothing was added; try again.', variant: 'destructive' })
    } finally {
      copying.current = false
    }
  }

  // S18 (Block B §16): a soft delete, so it says what stays and offers Undo.
  const handleDelete = async (template: { id: string; name: string }) => {
    const ok = await confirmDestructive({
      title: `Delete ${template.name}?`,
      description: 'It’s no longer offered when you reject someone. Rejection emails already sent with it stay.',
      confirmLabel: 'Delete template',
    })
    if (!ok) return
    const exit = collapseRows(rowsById([template.id]))
    await exit.done
    try {
      await deleteTemplate(template.id)
    } catch {
      exit.revert()
      return
    }
    undoToast(`${template.name} deleted`, async () => {
      await restoreTemplate(template.id)
      requestAnimationFrame(() => restoreRows(rowsById([template.id])))
    })
  }

  return (
    <>
      <LibraryCard
        title="Rejection templates"
        description="The emails you can send when you reject a candidate."
        what="rejection templates"
        addLabel="New template"
        onAdd={() => setSheet({ open: true, templateId: undefined })}
        loading={isLoading}
        error={loadError}
        onRetry={() => void refetchTemplates()}
        emptyTitle="No rejection templates yet"
        emptyBody="Write the email candidates get when they're not moving forward."
        onceKey="settings-rejection-templates"
        items={templates.map((t) => ({
          id: t.id,
          name: t.name,
          meta: t.subject,
          onEdit: () => setSheet({ open: true, templateId: t.id }),
          actions: [
            { label: 'Preview', icon: Eye, onSelect: () => setPreviewId(t.id) },
            { label: 'Duplicate', icon: Copy, onSelect: () => void handleDuplicate(t) },
          ],
          onDelete: () => void handleDelete({ id: t.id, name: t.name }),
        }))}
      />

      <TemplatePreviewDialog
        template={previewing}
        onClose={() => setPreviewId(null)}
        onEdit={() => {
          const id = previewId
          setPreviewId(null)
          if (id) setSheet({ open: true, templateId: id })
        }}
      />

      <RejectionEmailTemplateSheet
        open={sheet.open}
        onOpenChange={(open) => {
          setSheet({ open, templateId: undefined })
          if (!open) void refetchTemplates()
        }}
        templateId={sheet.templateId}
        template={templates.find((t) => t.id === sheet.templateId)}
        context="organization"
      />
    </>
  )
}
