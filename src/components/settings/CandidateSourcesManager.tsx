import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
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
    isCreating
  } = useCandidateSources(context)

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
                <TableRow key={source.id}>
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Source</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{source.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteSource(source.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
