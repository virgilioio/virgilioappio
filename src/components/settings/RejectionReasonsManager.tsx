import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
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

  const { 
    reasons, 
    platformReasons,
    tenantReasons,
    isLoading, 
    createReason, 
    updateReason, 
    deleteReason,
    isCreating 
  } = useRejectionReasons(context)

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
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    await updateReason({ id: editingId, name: editingName.trim() })
    setEditingId(null)
    setEditingName('')
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
                <TableHead>Description</TableHead>
                {editable && <TableHead className="text-right w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reasonsList.map((reason) => (
                <TableRow key={reason.id}>
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Reason</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{reason.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteReason(reason.id)}
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
