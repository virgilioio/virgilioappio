
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, FileText } from 'lucide-react'
import { useCountryFields } from '@/hooks/useCountryFields'
import { useCountries, CountryField } from '@/hooks/useCountries'
import { CountryFieldForm } from './CountryFieldForm'

interface CountryFieldsManagerProps {
  countryId: string
}

export function CountryFieldsManager({ countryId }: CountryFieldsManagerProps) {
  const { countries } = useCountries()
  const country = countries.find(c => c.id === countryId)
  const { fields, isLoading, deleteField } = useCountryFields(country?.code)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingField, setEditingField] = useState<CountryField | null>(null)

  const handleCreateField = () => {
    setEditingField(null)
    setIsFormOpen(true)
  }

  const handleEditField = (field: CountryField) => {
    setEditingField(field)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingField(null)
  }

  const handleDelete = async (fieldId: string) => {
    if (confirm('Are you sure you want to delete this field? This will remove all associated data.')) {
      await deleteField(fieldId)
    }
  }

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileText className="h-4 w-4" />
      default:
        return null
    }
  }

  const getFieldTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-blue-100 text-blue-800',
      number: 'bg-green-100 text-green-800',
      email: 'bg-purple-100 text-purple-800',
      textarea: 'bg-yellow-100 text-yellow-800',
      select: 'bg-orange-100 text-orange-800',
      checkbox: 'bg-pink-100 text-pink-800',
      date: 'bg-indigo-100 text-indigo-800',
      file: 'bg-red-100 text-red-800'
    }

    return (
      <Badge className={colors[type] || 'bg-gray-100 text-gray-800'}>
        {type}
      </Badge>
    )
  }

  if (!country) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Country not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                Custom Fields for {country.name}
              </CardTitle>
              <CardDescription>
                Define additional fields required for organizations in this country
              </CardDescription>
            </div>
            <Button className="gap-2" onClick={handleCreateField}>
              <Plus className="h-4 w-4" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : fields.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {field.field_name}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getFieldTypeIcon(field.field_type)}
                        {field.field_label}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getFieldTypeBadge(field.field_type)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={field.is_required ? 'destructive' : 'secondary'}>
                        {field.is_required ? 'Required' : 'Optional'}
                      </Badge>
                    </TableCell>
                    <TableCell>{field.display_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditField(field)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(field.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No custom fields yet</h3>
              <p className="text-muted-foreground mb-4">
                Add custom fields that organizations in {country.name} need to provide.
              </p>
              <Button className="gap-2" onClick={handleCreateField}>
                <Plus className="h-4 w-4" />
                Add Your First Field
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <CountryFieldForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        countryId={countryId}
        countryCode={country.code}
        field={editingField}
      />
    </>
  )
}
