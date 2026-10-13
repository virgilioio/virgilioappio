import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { IconTip } from '@/components/ui/tooltip'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { undoToast } from '@/lib/undoToast'
import { collapseRows, restoreRows, rowsById } from '@/lib/motion'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Plus, Edit, Trash2, UserX, UserMinus, Check, X } from 'lucide-react'
import { useRejectionReasons, type RejectionCategory, type RejectionReason } from '@/hooks/useRejectionReasons'

interface RejectionReasonsManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function RejectionReasonsManager({ context = 'organization' }: RejectionReasonsManagerProps) {
  const [category, setCategory] = useState<RejectionCategory>('recruiter_rejected')
  const [newReasonName, setNewReasonName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingClientLabel, setEditingClientLabel] = useState('')

  const { 
    reasons, 
    platformReasons,
    tenantReasons,
    isLoading, 
    createReason, 
    updateReason, 
    deleteReason,
    restoreReason,
    isCreating 
  } = useRejectionReasons(context)

  // S17 (Block B §16): a soft delete, so it says what stays and offers Undo.
  const handleDelete = async (reason: RejectionReason) => {
    const ok = await confirmDestructive({
      title: `Delete \u201c${reason.name}\u201d?`,
      description: 'It\u2019s no longer offered when you reject someone or record that they declined. Candidates already rejected with it keep it in their history.',
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
    undoToast(`\u201c${reason.name}\u201d deleted`, async () => {
      await restoreReason(reason.id)
      requestAnimationFrame(() => restoreRows(rowsById([reason.id])))
    })
  }

  const filteredPlatformReasons = platformReasons.filter(r => r.category === category)
  const filteredTenantReasons = tenantReasons.filter(r => r.category === category)
  const filteredReasons = reasons.filter(r => r.category === category)

  const handleCreate = async () => {
    if (!newReasonName.trim()) return
    await createReason({ 
      name: newReasonName.trim(), 
      category 
    })
    setNewReasonName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate()
    }
  }

  const startEdit = (reason: RejectionReason) => {
    setEditingId(reason.id)
    setEditingName(reason.name)
    setEditingClientLabel(reason.client_label || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
    setEditingClientLabel('')
  }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    await updateReason({ id: editingId, name: editingName.trim(), client_label: editingClientLabel.trim() || null })
    setEditingId(null)
    setEditingName('')
    setEditingClientLabel('')
  }

  const renderReasonsTable = (reasonsList: RejectionReason[], editable: boolean, title?: string) => (
    <div className="mb-6">
      {title && (
        <>
          <h4 className="text-sm font-semibold mb-2">{title}</h4>
          {!editable && (
            <p className="text-sm text-muted-foreground mb-4">
              Default reasons provided by the platform. These cannot be edited.
            </p>
          )}
        </>
      )}
      {reasonsList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No {category === 'recruiter_rejected' ? '"We Rejected"' : '"They Declined"'} reasons yet
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead>Client label</TableHead>
                <TableHead>Description</TableHead>
                {editable && <TableHead className="text-right w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reasonsList.map((reason) => (
                <TableRow key={reason.id} data-row-id={reason.id}>
                  <TableCell className="font-medium">
                    {editingId === reason.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      reason.name
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {editingId === reason.id ? (
                      <Input
                        value={editingClientLabel}
                        onChange={(e) => setEditingClientLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        placeholder='Shown to clients, e.g. “Skills gap”'
                        className="h-8"
                      />
                    ) : (
                      reason.client_label || 'Not progressed'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {reason.description || '—'}
                  </TableCell>
                  {editable && (
                    <TableCell className="text-right">
                      {editingId === reason.id ? (
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
                          <Button variant="ghost" size="sm" onClick={() => startEdit(reason)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <IconTip label={`Delete ${reason.name}`}>
                            <Button variant="ghost" size="sm" aria-label={`Delete ${reason.name}`} onClick={() => void handleDelete(reason)}>
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
        <CardTitle>Rejection Reasons</CardTitle>
        <CardDescription>
          Manage reasons for rejecting candidates or tracking when candidates decline offers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Toggle */}
        <ToggleGroup
          type="single"
          value={category}
          onValueChange={(value) => value && setCategory(value as RejectionCategory)}
          variant="outline"
          size="sm"
          className="justify-start"
        >
          <ToggleGroupItem value="recruiter_rejected" aria-label="We Rejected">
            <UserX className="h-4 w-4 mr-2" />
            We Rejected Them
          </ToggleGroupItem>
          <ToggleGroupItem value="candidate_declined" aria-label="They Declined">
            <UserMinus className="h-4 w-4 mr-2" />
            They Declined
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Quick Add Row */}
        <div className="flex items-center gap-2">
          <Input
            placeholder={`Add a ${category === 'recruiter_rejected' ? '"We Rejected"' : '"They Declined"'} reason...`}
            value={newReasonName}
            onChange={(e) => setNewReasonName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleCreate} disabled={!newReasonName.trim() || isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Platform reasons (read-only in org context) */}
        {context === 'organization' && filteredPlatformReasons.length > 0 && (
          renderReasonsTable(filteredPlatformReasons, false, 'Platform Defaults')
        )}

        {/* Tenant/editable reasons */}
        {context === 'organization' ? (
          renderReasonsTable(filteredTenantReasons, true, 'Custom Reasons')
        ) : (
          renderReasonsTable(filteredReasons, true)
        )}
      </CardContent>
    </Card>
  )
}
