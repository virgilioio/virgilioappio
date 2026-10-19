import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/sign/templates/parts'
import { undoToast } from '@/lib/undoToast'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { useCandidateSources, type CandidateSource } from '@/hooks/useCandidateSources'
import { LibraryCard } from './shared/LibraryCard'

/**
 * Settings › Templates › Candidate sources (2026-10-19): one list, the shared
 * sources and Virgilio's own together. A deleted source is soft-deleted, so
 * it has Undo.
 */
export function CandidateSourcesManager() {
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<CandidateSource | null>(null)
  const { sources, isLoading, loadError, refetch, createSource, deleteSource, restoreSource, isCreating } = useCandidateSources('organization')

  // S19 (Block B §16): a soft delete, so it says what stays and offers Undo.
  const handleDelete = async (source: CandidateSource) => {
    const ok = await confirmDestructive({
      title: `Delete “${source.name}”?`,
      description: 'It’s no longer offered when you add a candidate. Candidates already tagged with it keep it.',
      confirmLabel: 'Delete source',
    })
    if (!ok) return
    const exit = collapseRows(rowsById([source.id]))
    await exit.done
    try {
      await deleteSource(source.id)
    } catch {
      exit.revert()
      return
    }
    undoToast(`“${source.name}” deleted`, async () => {
      await restoreSource(source.id)
      requestAnimationFrame(() => restoreRows(rowsById([source.id])))
    })
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || isCreating) return
    try {
      await createSource({ name })
      setNewName('')
    } catch {
      // the hook shows the error
    }
  }

  return (
    <>
      <LibraryCard
        title="Candidate sources"
        description="Where candidates come from, picked when you add one."
        what="candidate sources"
        loading={isLoading}
        error={loadError}
        onRetry={() => void refetch()}
        emptyTitle="No sources yet"
        emptyBody="Add one above."
        items={sources.map((s) => ({
          id: s.id,
          name: s.name,
          meta: s.description || undefined,
          onEdit: () => setEditing(s),
          onDelete: () => void handleDelete(s),
        }))}
      >
        <div className="flex items-center gap-2 border-b border-[#F1F0EC] px-[18px] py-3">
          <Input
            placeholder="Add a source, e.g. Referral"
            aria-label="New source"
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
      </LibraryCard>

      <EditSourceDialog source={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function EditSourceDialog({ source, onClose }: { source: CandidateSource | null; onClose: () => void }) {
  const { updateSource, isUpdating } = useCandidateSources('organization')
  const [name, setName] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  if (source && shown !== source.id) {
    setShown(source.id)
    setName(source.name)
  }
  if (!source && shown) setShown(null)

  const save = async () => {
    if (!source || !name.trim()) return
    try {
      await updateSource({ id: source.id, name: name.trim() })
      onClose()
    } catch {
      // the hook shows the error; the dialog stays open
    }
  }

  return (
    <Dialog open={!!source} onOpenChange={(o) => !o && !isUpdating && onClose()}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Rename source</DialogTitle>
          <DialogDescription>Candidates already tagged with it show the new name.</DialogDescription>
        </DialogHeader>
        <Field label="Source" required htmlFor="source-name">
          <Input id="source-name" value={name} maxLength={120} disabled={isUpdating} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={isUpdating} disabled={!name.trim()}>
            Save source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
