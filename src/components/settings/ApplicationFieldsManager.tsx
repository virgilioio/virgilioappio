
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useApplicationFields, ApplicationField } from '@/hooks/useApplicationFields'
import { ApplicationFieldForm } from './ApplicationFieldForm'
import { Plus, Edit, Trash2 } from 'lucide-react'

interface ApplicationFieldsManagerProps {
  context?: 'platform-defaults' | 'organization'
}

export function ApplicationFieldsManager({ context = 'organization' }: ApplicationFieldsManagerProps) {
  const { fields, isLoading, deleteField, refetch, copyPlatformTemplate } = useApplicationFields(context)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingField, setEditingField] = useState<ApplicationField | null>(null)

  const platformFields = fields?.filter(f => f.source === 'platform')
  const tenantFields = fields?.filter(f => f.source === 'tenant')

  const handleEdit = (field: ApplicationField) => setEditingField(field)
  const handleCloseEdit = () => setEditingField(null)

  const handleCopy = async (fieldId: string) => {
    await copyPlatformTemplate(fieldId)
  }

  return (
    <>
      {context === 'organization' && platformFields.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Platform Library</CardTitle>
            <CardDescription>
              Default fields provided by the platform. Copy to your library to customize.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platformFields.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.field_label}</TableCell>
                        <TableCell>{f.field_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-xs">{f.field_type}</Badge>
                        </TableCell>
                        <TableCell>{f.is_default ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{f.display_order}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleCopy(f.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" /> Copy to My Library
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {context === 'organization' ? 'My Custom Fields Library' : 'Custom Application Fields Library'}
            </CardTitle>
            <CardDescription>
              {context === 'organization'
                ? 'Custom fields for your organization. Core fields (name, email, phone, resume, etc.) are included automatically.'
                : 'Create and manage additional application fields for your job postings. Core fields (name, email, phone, resume, etc.) are included automatically.'
              }
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Custom Field
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (context === 'organization' ? tenantFields : fields).length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground mb-3">No custom application fields yet.</p>
              <p className="text-xs text-muted-foreground mb-4">Core fields (name, email, phone, resume, etc.) are included automatically in all applications.</p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add your first custom field
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(context === 'organization' ? tenantFields : fields).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.field_label}</TableCell>
                      <TableCell>{f.field_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-xs">{f.field_type}</Badge>
                      </TableCell>
                      <TableCell>{f.is_default ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{f.display_order}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(f)}
                          >
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
                                <AlertDialogTitle>Delete Field</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{f.field_label}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    await deleteField(f.id)
                                    await refetch()
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
    </>
  )
}
