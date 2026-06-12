import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useApplicationFields, ApplicationField } from '@/hooks/useApplicationFields'
import { ApplicationFieldForm } from './ApplicationFieldForm'
import { Plus, Copy, Pencil, Trash2, Loader2 } from 'lucide-react'
import { SpecCard } from './shared/SpecCard'
import { SpecRow, SpecEmpty, NOIR_BTN, SEC_BTN } from './shared/SpecRow'
import { SpecChip } from './shared/SpecChip'

interface ApplicationFieldsManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function ApplicationFieldsManager({ context = 'organization' }: ApplicationFieldsManagerProps) {
  const { fields, isLoading, deleteField, refetch, copyPlatformTemplate } = useApplicationFields(context)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ApplicationField | null>(null)
  const [toDelete, setToDelete] = useState<ApplicationField | null>(null)

  const allPlatform = (fields || []).filter(f => f.source === 'platform')
  const coreFields = allPlatform
    .filter(f => f.is_core_field === true)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const platformFields = allPlatform.filter(f => f.is_core_field !== true)
  const tenantFields = (fields || []).filter(f => f.source === 'tenant')
  const listFields = context === 'organization' ? tenantFields : (fields || []).filter(f => f.is_core_field !== true)

  return (
    <div className="max-w-[860px]">
      <SpecCard
        title="Standard fields"
        description="Always collected on every application. Required by the platform and can't be edited."
      >
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
        ) : coreFields.length === 0 ? (
          <SpecEmpty title="No standard fields available." />
        ) : (
          coreFields.map((f, i) => (
            <SpecRow key={f.id} last={i === coreFields.length - 1}>
              <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span className="font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {f.field_label}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8B8F9E' }}>
                  {f.field_name}
                </span>
              </div>
              <SpecChip tone="gray">{f.field_type}</SpecChip>
              <SpecChip tone="purple">Required</SpecChip>
            </SpecRow>
          ))
        )}
      </SpecCard>

      {context === 'organization' && (
        <SpecCard
          title="Platform fields"
          description="Optional fields you can copy and customize."
        >
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
          ) : platformFields.length === 0 ? (
            <SpecEmpty title="No optional platform fields available." />
          ) : (
            platformFields.map((f, i) => (
              <SpecRow key={f.id} last={i === platformFields.length - 1}>
                <div className="flex-1 min-w-0 flex items-baseline gap-2">
                  <span className="font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {f.field_label}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8B8F9E' }}>
                    {f.field_name}
                  </span>
                </div>
                <SpecChip tone="gray">{f.field_type}</SpecChip>
                <button
                  type="button"
                  className={SEC_BTN}
                  style={{ height: 26, padding: '0 10px', fontSize: 11.5 }}
                  onClick={() => copyPlatformTemplate(f.id)}
                >
                  <Copy size={11} /> Copy
                </button>
              </SpecRow>
            ))
          )}
        </SpecCard>
      )}


      <SpecCard
        title="My custom fields"
        description="Organization-specific questions on every application."
        action={
          <button
            type="button"
            className={NOIR_BTN}
            style={{ height: 30, padding: '0 12px', fontSize: 12 }}
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={13} /> Add custom field
          </button>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B8F9E]" /></div>
        ) : listFields.length === 0 ? (
          <SpecEmpty title="No custom fields yet" body="Add one to start collecting more from applicants." />
        ) : (
          listFields.map((f, i) => (
            <SpecRow key={f.id} last={i === listFields.length - 1}>
              <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span className="font-inter text-[#0d0d09] truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {f.field_label}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#8B8F9E' }}>
                  {f.field_name}
                </span>
              </div>
              <SpecChip tone="gray">{f.field_type}</SpecChip>
              <button
                type="button"
                className="text-[#8B8F9E] hover:text-[#0d0d09] transition-colors"
                onClick={() => setEditing(f)}
                aria-label="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className="text-[#8B8F9E] hover:text-[#B91C1C] transition-colors"
                onClick={() => setToDelete(f)}
                aria-label="Delete"
              >
                <Trash2 size={13} />
              </button>
            </SpecRow>
          ))
        )}
      </SpecCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create new field</DialogTitle>
            <DialogDescription>Add a new field to the application form</DialogDescription>
          </DialogHeader>
          <ApplicationFieldForm onClose={() => setCreateOpen(false)} onSaved={refetch} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit field</DialogTitle>
            <DialogDescription>Update the field details</DialogDescription>
          </DialogHeader>
          {editing && <ApplicationFieldForm field={editing} onClose={() => setEditing(null)} onSaved={refetch} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{toDelete?.field_label}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (toDelete) { await deleteField(toDelete.id); await refetch(); setToDelete(null) } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
