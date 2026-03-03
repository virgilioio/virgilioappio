import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, List, ClipboardList } from 'lucide-react'
import { useOfferForms, type OfferFormsContext } from '@/hooks/useOfferForms'
import { OfferFormSheet } from './templates/OfferFormSheet'
import { OfferFormFieldsManager } from './OfferFormFieldsManager'

interface OfferFormsManagerProps {
  context?: OfferFormsContext
}

export function OfferFormsManager({ context = 'organization' }: OfferFormsManagerProps) {
  const { forms, isLoading, deleteForm } = useOfferForms(context)
  const [formSheet, setFormSheet] = useState({ open: false, formId: undefined as string | undefined })
  const [fieldsDialog, setFieldsDialog] = useState({ open: false, formId: '' })

  const tenantForms = forms.filter(f => f.source === 'tenant')
  const displayForms = context === 'organization' ? tenantForms : forms

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {context === 'platform-defaults' ? 'Platform Default Offer Forms' : 'Offer Forms'}
          </h3>
          <Button onClick={() => setFormSheet({ open: true, formId: undefined })}>
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading forms...</div>
        ) : displayForms.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No offer forms found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first offer form to get started
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayForms.map((form) => (
                <TableRow key={form.id}>
                  <TableCell className="font-medium">{form.name}</TableCell>
                  <TableCell>
                    {form.description || <span className="text-muted-foreground italic">No description</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={form.is_active ? 'default' : 'secondary'}>
                      {form.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(form.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFieldsDialog({ open: true, formId: form.id })}
                        title="Manage Fields"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormSheet({ open: true, formId: form.id })}
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
                            <AlertDialogTitle>Delete Form</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{form.name}"? This will also delete all associated fields. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteForm(form.id)}
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
        )}
      </CardContent>

      <OfferFormSheet
        open={formSheet.open}
        onOpenChange={(open) => setFormSheet({ open, formId: undefined })}
        formId={formSheet.formId}
        context={context}
      />

      <Dialog open={fieldsDialog.open} onOpenChange={(open) => setFieldsDialog({ open, formId: '' })}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Form Fields</DialogTitle>
          </DialogHeader>
          {fieldsDialog.formId && (
            <OfferFormFieldsManager formId={fieldsDialog.formId} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
