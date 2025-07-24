import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Edit, Trash2, FileText, Type, Hash, Mail, Calendar, CheckSquare, List } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface CountryFieldsListProps {
  fields: any[]
  onEdit: (field: any) => void
  onRefetch: () => void
}

export function CountryFieldsList({ fields, onEdit, onRefetch }: CountryFieldsListProps) {
  const [deletingField, setDeletingField] = useState<string | null>(null)

  const getFieldTypeIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text':
        return <Type className="h-4 w-4" />
      case 'textarea':
        return <FileText className="h-4 w-4" />
      case 'number':
        return <Hash className="h-4 w-4" />
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'date':
        return <Calendar className="h-4 w-4" />
      case 'checkbox':
        return <CheckSquare className="h-4 w-4" />
      case 'select':
        return <List className="h-4 w-4" />
      case 'file':
        return <FileText className="h-4 w-4" />
      default:
        return <Type className="h-4 w-4" />
    }
  }

  const handleDeleteField = async (fieldId: string) => {
    try {
      setDeletingField(fieldId)
      
      const { error } = await supabase
        .from('worker_compliance_fields')
        .delete()
        .eq('id', fieldId)

      if (error) throw error

      toast.success('Field deleted successfully')
      onRefetch()
    } catch (error) {
      console.error('Error deleting field:', error)
      toast.error('Failed to delete field')
    } finally {
      setDeletingField(null)
    }
  }

  if (fields.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No compliance fields configured</h3>
          <p className="text-muted-foreground mb-4">
            Get started by adding compliance fields for this country
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field) => (
              <TableRow key={field.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getFieldTypeIcon(field.field_type)}
                    <div>
                      <div className="font-medium">{field.field_label}</div>
                      {field.help_text && (
                        <div className="text-sm text-muted-foreground">{field.help_text}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {field.field_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {field.is_required ? (
                    <Badge variant="destructive">Required</Badge>
                  ) : (
                    <Badge variant="outline">Optional</Badge>
                  )}
                </TableCell>
                <TableCell>{field.display_order}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(field)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingField === field.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Field</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the field "{field.field_label}"? 
                            This action cannot be undone and will remove all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteField(field.id)}
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
      </CardContent>
    </Card>
  )
}