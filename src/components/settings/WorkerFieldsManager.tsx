import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, ArrowLeft, Edit, Trash2, FileText, Type, Hash, Mail, Calendar, CheckSquare, Upload } from 'lucide-react'
import { useWorkerComplianceFields } from '@/hooks/useWorkerComplianceFields'
import { useWorkerComplianceCountries } from '@/hooks/useWorkerComplianceCountries'
import { WorkerComplianceFieldForm } from './WorkerComplianceFieldForm'
import { toast } from 'sonner'

interface WorkerFieldsManagerProps {
  countryId: string
  countryName: string
  onBack: () => void
}

export function WorkerFieldsManager({ countryId, countryName, onBack }: WorkerFieldsManagerProps) {
  const { countries } = useWorkerComplianceCountries()
  const selectedCountry = countries.find(c => c.id === countryId)
  const { fields, isLoading, createField, updateField, deleteField, refetch } = useWorkerComplianceFields(selectedCountry?.code)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingField, setEditingField] = useState<any>(null)

  // All fields for this worker compliance country
  const countryFields = fields || []

  const handleCreateField = () => {
    setEditingField(null)
    setIsFormOpen(true)
  }

  const handleEditField = (field: any) => {
    setEditingField(field)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingField(null)
  }

  const handleFieldChange = () => {
    refetch()
  }

  const handleDelete = async (fieldId: string) => {
    try {
      await deleteField(fieldId)
      toast.success('Field deleted successfully')
    } catch (error) {
      toast.error('Failed to delete field')
    }
  }

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="h-4 w-4" />
      case 'number': return <Hash className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'date': return <Calendar className="h-4 w-4" />
      case 'checkbox': return <CheckSquare className="h-4 w-4" />
      case 'file': return <Upload className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getFieldTypeBadge = (type: string) => {
    const colors = {
      text: 'bg-blue-50 text-blue-700 border-blue-200',
      number: 'bg-green-50 text-green-700 border-green-200',
      email: 'bg-purple-50 text-purple-700 border-purple-200',
      textarea: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      select: 'bg-orange-50 text-orange-700 border-orange-200',
      checkbox: 'bg-pink-50 text-pink-700 border-pink-200',
      date: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      file: 'bg-red-50 text-red-700 border-red-200',
    }
    return colors[type as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Countries
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Worker Compliance Fields - {countryName}
          </h2>
          <p className="text-muted-foreground">
            Manage worker-specific compliance fields for {countryName}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Worker Compliance Fields</CardTitle>
              <CardDescription>
                Configure the fields workers from {countryName} need to complete for compliance
              </CardDescription>
            </div>
            <Button onClick={handleCreateField}>
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse border rounded-lg p-4">
                  <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : countryFields.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No worker compliance fields yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by adding the first compliance field for workers from {countryName}
              </p>
              <Button onClick={handleCreateField}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Field
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {countryFields.map((field) => (
                <div key={field.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getFieldTypeIcon(field.field_type)}
                      <div>
                        <h4 className="font-medium">{field.field_label}</h4>
                        <p className="text-sm text-muted-foreground">
                          Field name: {field.field_name}
                        </p>
                        {field.help_text && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {field.help_text}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={getFieldTypeBadge(field.field_type)}
                      >
                        {field.field_type}
                      </Badge>
                      {field.is_required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
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
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isFormOpen && selectedCountry && (
        <WorkerComplianceFieldForm
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          countryId={countryId}
          countryCode={selectedCountry.code}
          field={editingField}
          onFieldChange={handleFieldChange}
        />
      )}
    </div>
  )
}