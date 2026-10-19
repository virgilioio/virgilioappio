import { useState } from 'react'
import { Plus, UserMinus, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { Field, Seg } from '@/components/sign/templates/parts'
import { undoToast } from '@/lib/undoToast'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { useRejectionReasons, type RejectionCategory, type RejectionReason } from '@/hooks/useRejectionReasons'
import { LibraryCard } from './shared/LibraryCard'

const CATEGORY_LABEL: Record<RejectionCategory, string> = {
  recruiter_rejected: 'We rejected them',
  candidate_declined: 'They declined',
}

/**
 * Settings › Templates › Rejection reasons (2026-10-19): one list per
 * category, the shared reasons and Virgilio's own together, all editable by
 * workspace admins. A deleted reason is soft-deleted, so it has Undo.
 */
export function RejectionReasonsManager() {
  const [category, setCategory] = useState<RejectionCategory>('recruiter_rejected')
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<RejectionReason | null>(null)

  const { reasons, isLoading, loadError, refetch, createReason, deleteReason, restoreReason, isCreating } = useRejectionReasons('organization')

  const handleDelete = async (reason: RejectionReason) => {
    const ok = await confirmDestructive({
      title: `Delete “${reason.name}”?`,
      description: 'It’s no longer offered when you reject someone or record that they declined. Candidates already rejected with it keep it in their history.',
      confirmLabel: 'Delete reason',
    })
    if (!ok) return
    const exit = collapseRows(rowsById([reason.id]))
    await exit.done
    try {
      await deleteReason(reason.id)
    } catch {
      exit.revert()
      return
    }
    undoToast(`“${reason.name}” deleted`, async () => {
      await restoreReason(reason.id)
      requestAnimationFrame(() => restoreRows(rowsById([reason.id])))
    })
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || isCreating) return
    try {
      await createReason({ name, category })
      setNewName('')
    } catch {
      // the hook shows the error
    }
  }

  const listed = reasons.filter((r) => r.category === category)

  return (
    <>
      <LibraryCard
        title="Rejection reasons"
        description="Offered when you reject a candidate or record that they declined."
        what="rejection reasons"
        loading={isLoading}
        error={loadError}
        onRetry={() => void refetch()}
        emptyTitle={`No “${CATEGORY_LABEL[category]}” reasons yet`}
        emptyBody="Add one above."
        items={listed.map((r) => ({
          id: r.id,
          name: r.name,
          meta: `Clients see “${r.client_label || 'Not progressed'}”`,
          onEdit: () => setEditing(r),
          onDelete: () => void handleDelete(r),
        }))}
      >
        <div className="flex flex-col gap-3 border-b border-[#F1F0EC] px-[18px] py-3">
          <Seg
            label="Kind of reason"
            value={category}
            onChange={(v) => setCategory(v as RejectionCategory)}
            options={[
              { value: 'recruiter_rejected', label: CATEGORY_LABEL.recruiter_rejected, icon: UserX },
              { value: 'candidate_declined', label: CATEGORY_LABEL.candidate_declined, icon: UserMinus },
            ]}
          />
          <div className="flex items-center gap-2">
            <Input
              placeholder={`Add a “${CATEGORY_LABEL[category]}” reason`}
              aria-label="New reason"
              value={newName}
              maxLength={120}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
              className="flex-1"
            />
            <Button icon={Plus} onClick={() => void handleCreate()} disabled={!newName.trim()} loading={isCreating}>
              Add
            </Button>
          </div>
        </div>
      </LibraryCard>

      <EditReasonDialog reason={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function EditReasonDialog({ reason, onClose }: { reason: RejectionReason | null; onClose: () => void }) {
  const { updateReason, isUpdating } = useRejectionReasons('organization')
  const [name, setName] = useState('')
  const [clientLabel, setClientLabel] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  if (reason && shown !== reason.id) {
    setShown(reason.id)
    setName(reason.name)
    setClientLabel(reason.client_label || '')
  }
  if (!reason && shown) setShown(null)

  const save = async () => {
    if (!reason || !name.trim()) return
    try {
      await updateReason({ id: reason.id, name: name.trim(), client_label: clientLabel.trim() || null })
      onClose()
    } catch {
      // the hook shows the error; the dialog stays open
    }
  }

  return (
    <Dialog open={!!reason} onOpenChange={(o) => !o && !isUpdating && onClose()}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit reason</DialogTitle>
          <DialogDescription>Candidates already rejected with it show the new name.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Reason" required htmlFor="reason-name">
            <Input id="reason-name" value={name} maxLength={120} disabled={isUpdating} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
          </Field>
          <Field label="Clients see" optional htmlFor="reason-client" help="What a client sees for this candidate. Leave it empty for “Not progressed”.">
            <Input id="reason-client" value={clientLabel} maxLength={80} disabled={isUpdating} placeholder="e.g. Skills gap" onChange={(e) => setClientLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={isUpdating} disabled={!name.trim()}>
            Save reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
