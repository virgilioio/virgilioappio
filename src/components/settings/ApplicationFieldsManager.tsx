import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useApplicationFields, ApplicationField } from '@/hooks/useApplicationFields'
import { ApplicationFieldForm } from './ApplicationFieldForm'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export function ApplicationFieldsManager() {
  const { fields, isLoading, deleteField, refetch } = useApplicationFields()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingField, setEditingField] = useState<ApplicationField | null>(null)

  const handleEdit = (field: ApplicationField) => setEditingField(field)
  const handleCloseEdit = () => setEditingField(null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Application Fields</CardTitle>
          <CardDescription>Manage dynamic fields used to build application forms</CardDescription>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Field
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : fields.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground mb-3">No application fields yet.</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add your first field
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.field_label}</TableCell>
                    <TableCell>{f.field_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">{f.field_type}</Badge>
                    </TableCell>
                    <TableCell>{f.is_required ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{f.display_order}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(f)}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (confirm('Delete this field?')) {
                            await deleteField(f.id)
                            await refetch()
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Field</DialogTitle>
            <DialogDescription>Add a new field to the application fields library</DialogDescription>
          </DialogHeader>
          <ApplicationFieldForm
            onClose={() => setIsCreateOpen(false)}
            onSaved={refetch}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingField} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>Update the field details</DialogDescription>
          </DialogHeader>
          {editingField && (
            <ApplicationFieldForm field={editingField} onClose={handleCloseEdit} onSaved={refetch} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
