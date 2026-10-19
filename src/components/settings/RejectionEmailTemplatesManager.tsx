import { useState } from 'react'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { undoToast } from '@/lib/undoToast'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates'
import { RejectionEmailTemplateSheet } from './templates/RejectionEmailTemplateSheet'
import { LibraryCard } from './shared/LibraryCard'

/**
 * Settings › Templates › Rejection templates (2026-10-19): one list, the
 * shared emails and Virgilio's own together. A deleted template is
 * soft-deleted, so it has Undo.
 */
export function RejectionEmailTemplatesManager() {
  const { templates, isLoading, loadError, refetchTemplates, deleteTemplate, restoreTemplate } = useRejectionEmailTemplates('organization')
  const [sheet, setSheet] = useState({ open: false, templateId: undefined as string | undefined })

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
          onDelete: () => void handleDelete({ id: t.id, name: t.name }),
        }))}
      />

      <RejectionEmailTemplateSheet
        open={sheet.open}
        onOpenChange={(open) => {
          setSheet({ open, templateId: undefined })
          if (!open) void refetchTemplates()
        }}
        templateId={sheet.templateId}
        context="organization"
      />
    </>
  )
}
