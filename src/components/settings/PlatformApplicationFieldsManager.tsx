import { ApplicationFieldForm } from './ApplicationFieldForm'
import { useApplicationFields } from '@/hooks/useApplicationFields'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2 } from 'lucide-react'
import type { ApplicationFieldWithRelations } from '@/hooks/useApplicationFields'

export function PlatformApplicationFieldsManager() {
  const { fields, isLoading, createField, updateField, deleteField } = useApplicationFields('platform-defaults')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingField, setEditingField] = useState<ApplicationFieldWithRelations | null>(null)

  const handleEdit = (field: ApplicationFieldWithRelations) => {
    setEditingField(field)
  }

  const handleSaved = () => {
    setIsCreateOpen(false)
    setEditingField(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Platform Default Application Fields</CardTitle>
          <CardDescription>
            Manage platform-wide default application fields that organizations can inherit and use in their job postings.
          </CardDescription>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Default Field
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Loading fields...</div>
        ) : fields.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            No platform default fields created yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.field_label}</TableCell>
                  <TableCell className="font-mono text-sm">{field.field_name}</TableCell>
                  <TableCell>{field.field_type}</TableCell>
                  <TableCell>
                    {field.is_default && <Badge variant="secondary">Default</Badge>}
                  </TableCell>
                  <TableCell>{field.display_order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(field)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteField(field.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Platform Default Application Field</DialogTitle>
          </DialogHeader>
          <ApplicationFieldForm 
            onClose={() => setIsCreateOpen(false)}
            onSaved={handleSaved}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingField} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Platform Default Application Field</DialogTitle>
          </DialogHeader>
          <ApplicationFieldForm 
            field={editingField}
            onClose={() => setEditingField(null)}
            onSaved={handleSaved}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}