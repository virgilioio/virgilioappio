import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/use-toast'
import { useApplicationFields, ApplicationField } from '@/hooks/useApplicationFields'
import { fieldTypeLabel } from '@/components/shared/FormFieldEditor'
import { collapseRows, rowsById } from '@/lib/motion'
import { ApplicationFieldForm } from './ApplicationFieldForm'
import { LibraryCard } from './shared/LibraryCard'
import { SpecChip } from './shared/SpecChip'

const typeLabel = (t: string) => {
  const l = fieldTypeLabel(t)
  return l.charAt(0).toUpperCase() + l.slice(1).replace(/_/g, ' ')
}

/**
 * Settings › Application form (2026-10-19): the standard fields every
 * application collects (read-only), then one list of the other fields, the
 * shared ones and Virgilio's own together. "Default" fields are added to
 * every new job posting.
 */
export function ApplicationFieldsManager() {
  const { fields, isLoading, loadError, deleteField, refetch } = useApplicationFields('organization')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ApplicationField | null>(null)

  // S10 (Block B §16): name the field; a failed delete says so.
  const handleDelete = async (f: ApplicationField) => {
    const label = f.field_label || f.field_name
    const ok = await confirmDestructive({
      title: `Delete the “${label}” field?`,
      description: 'It’s removed from the application form, so new applicants aren’t asked it. Answers candidates already gave stay. This can’t be undone.',
      confirmLabel: 'Delete field',
    })
    if (!ok) return
    const exit = collapseRows(rowsById([f.id]))
    try {
      await exit.done
      await deleteField(f.id)
      await refetch()
    } catch (e) {
      console.error('Failed to delete application field:', e)
      exit.revert()
      toast({ title: `Couldn’t delete “${label}”`, description: 'Nothing was removed; try again.', variant: 'destructive' })
    }
  }

  const all = fields || []
  const core = all.filter((f) => f.is_core_field === true).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const rest = all.filter((f) => f.is_core_field !== true)

  return (
    <div className="max-w-[860px]">
      <LibraryCard
        title="Standard fields"
        description="Every application collects these. They can't be changed."
        what="the standard fields"
        loading={isLoading}
        error={loadError}
        onRetry={() => void refetch()}
        emptyTitle="No standard fields"
        items={core.map((f) => ({
          id: f.id,
          name: f.field_label,
          chips: (
            <>
              <SpecChip tone="gray">{typeLabel(f.field_type)}</SpecChip>
              <SpecChip tone="purple">Required</SpecChip>
            </>
          ),
        }))}
      />

      <LibraryCard
        title="Application fields"
        description="More questions for applicants. Default fields are added to every new job posting."
        what="application fields"
        addLabel="Add field"
        onAdd={() => setCreateOpen(true)}
        loading={isLoading}
        error={loadError}
        onRetry={() => void refetch()}
        emptyTitle="No extra fields yet"
        emptyBody="Add a question to ask every applicant."
        onceKey="settings-application-fields"
        items={rest.map((f) => ({
          id: f.id,
          name: f.field_label || f.field_name,
          meta: f.help_text || undefined,
          chips: (
            <>
              <SpecChip tone="gray">{typeLabel(f.field_type)}</SpecChip>
              {f.is_default && <SpecChip tone="green">Default</SpecChip>}
            </>
          ),
          onEdit: () => setEditing(f),
          onDelete: () => void handleDelete(f),
        }))}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New field</DialogTitle>
            <DialogDescription>Add a question to the application form.</DialogDescription>
          </DialogHeader>
          <ApplicationFieldForm onClose={() => setCreateOpen(false)} onSaved={refetch} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit field</DialogTitle>
            <DialogDescription>Changes apply to new applications.</DialogDescription>
          </DialogHeader>
          {editing && <ApplicationFieldForm field={editing} onClose={() => setEditing(null)} onSaved={refetch} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
