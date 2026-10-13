import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconTip } from '@/components/ui/tooltip'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { undoToast } from '@/lib/undoToast'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Plus, Edit, Trash2, Check, X } from 'lucide-react'
import { useCandidateSources, type CandidateSource } from '@/hooks/useCandidateSources'

interface CandidateSourcesManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function CandidateSourcesManager({ context = 'organization' }: CandidateSourcesManagerProps) {
  const [newSourceName, setNewSourceName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const {
    sources,
    platformSources,
    tenantSources,
    isLoading,
    createSource,
    updateSource,
    deleteSource,
    restoreSource,
    isCreating
  } = useCandidateSources(context)

  // S19 (Block B §16): a soft delete, so it says what stays and offers Undo.
  const handleDelete = async (source: CandidateSource) => {
    const ok = await confirmDestructive({
      title: `Delete \u201c${source.name}\u201d?`,
      description: 'It\u2019s no longer offered when you add a candidate. Candidates already tagged with it keep it.',
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
    undoToast(`\u201c${source.name}\u201d deleted`, async () => {
      await restoreSource(source.id)
      requestAnimationFrame(() => restoreRows(rowsById([source.id])))
    })
  }

  const handleCreate = async () => {
    if (!newSourceName.trim()) return
    await createSource({ name: newSourceName.trim() })
    setNewSourceName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate()
  }

  const startEdit = (source: CandidateSource) => {
    setEditingId(source.id)
    setEditingName(source.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    await updateSource({ id: editingId, name: editingName.trim() })
    setEditingId(null)
    setEditingName('')
  }

  const renderSourcesTable = (sourcesList: CandidateSource[], editable: boolean, title?: string) => (
    <div className="mb-6">
      {title && (
        <>
          <h4 className="text-sm font-semibold mb-2">{title}</h4>
          {!editable && (
            <p className="text-sm text-muted-foreground mb-4">
              Default sources provided by the platform. These cannot be edited.
            </p>
          )}
        </>
      )}
      {sourcesList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No candidate sources yet
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Name</TableHead>
                <TableHead>Description</TableHead>
                {editable && <TableHead className="text-right w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourcesList.map((source) => (
                <TableRow key={source.id} data-row-id={source.id}>
                  <TableCell className="font-medium">
                    {editingId === source.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      source.name
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {source.description || '—'}
                  </TableCell>
                  {editable && (
                    <TableCell className="text-right">
                      {editingId === source.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={saveEdit}>
                            <Check className="h-4 w-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(source)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <IconTip label={`Delete ${source.name}`}>
                            <Button variant="ghost" size="sm" aria-label={`Delete ${source.name}`} onClick={() => void handleDelete(source)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </IconTip>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={3} />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Sources</CardTitle>
        <CardDescription>
          Manage sources for tracking where candidates come from
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Add Row */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add a new candidate source..."
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleCreate} disabled={!newSourceName.trim() || isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Platform sources (read-only in org context) */}
        {context === 'organization' && platformSources.length > 0 && (
          renderSourcesTable(platformSources, false, 'Platform Defaults')
        )}

        {/* Tenant/editable sources */}
        {context === 'organization' ? (
          renderSourcesTable(tenantSources, true, 'Custom Sources')
        ) : (
          renderSourcesTable(sources, true)
        )}
      </CardContent>
    </Card>
  )
}
