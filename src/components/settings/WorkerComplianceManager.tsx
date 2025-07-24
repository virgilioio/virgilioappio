import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Settings, Users, FileText, Edit, Trash2 } from 'lucide-react'
import { useCountries } from '@/hooks/useCountries'
import { useCountryFields } from '@/hooks/useCountryFields'
import { WorkerFieldsManager } from './WorkerFieldsManager'
import { CountryForm } from './CountryForm'

export function WorkerComplianceManager() {
  const { countries, isLoading: countriesLoading, createCountry, deleteCountry } = useCountries()
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null)
  const [isManagingFields, setIsManagingFields] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCountry, setEditingCountry] = useState<any>(null)

  const selectedCountry = countries.find(c => c.id === selectedCountryId)

  const handleManageFields = (countryId: string) => {
    setSelectedCountryId(countryId)
    setIsManagingFields(true)
  }

  const handleBackToList = () => {
    setIsManagingFields(false)
    setSelectedCountryId(null)
  }

  const handleAddCountry = () => {
    // This would open a form to add a new country
    // For now, we'll just show a message since country creation
    // should probably be handled in the main Countries tab
    alert('Please use the Countries tab to add new countries, then return here to manage worker compliance fields.')
  }

  const handleEdit = (country: any) => {
    setEditingCountry(country)
    setIsFormOpen(true)
  }

  const handleCreate = () => {
    setEditingCountry(null)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to deactivate this country?')) {
      await deleteCountry(id)
    }
  }

  if (isManagingFields && selectedCountry) {
    return (
      <WorkerFieldsManager 
        countryId={selectedCountryId!}
        countryName={selectedCountry.name}
        onBack={handleBackToList}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <Users className="h-5 w-5" />
                Worker Compliance Management
              </CardTitle>
              <CardDescription>
                Manage country-specific compliance requirements for workers
              </CardDescription>
            </div>
            <Button onClick={handleAddCountry} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Country
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {countriesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Worker Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.map((country) => (
                  <CountryComplianceRow 
                    key={country.id}
                    country={country}
                    onManageFields={() => handleManageFields(country.id)}
                    onEdit={() => handleEdit(country)}
                    onDelete={() => handleDelete(country.id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CountryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        country={editingCountry}
      />
    </div>
  )
}

interface CountryComplianceRowProps {
  country: any
  onManageFields: () => void
  onEdit: () => void
  onDelete: () => void
}

function CountryComplianceRow({ country, onManageFields, onEdit, onDelete }: CountryComplianceRowProps) {
  const { fields, isLoading } = useCountryFields(country.code)

  const workerFields = fields.filter(field => 
    field.field_name.includes('worker_') || 
    field.field_label.toLowerCase().includes('worker') ||
    field.field_label.toLowerCase().includes('employee')
  )

  return (
    <TableRow>
      <TableCell className="font-medium">{country.name}</TableCell>
      <TableCell>
        <code className="bg-muted px-2 py-1 rounded text-sm">
          {country.code}
        </code>
      </TableCell>
      <TableCell>
        <Badge variant={country.is_active ? 'default' : 'secondary'}>
          {country.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {isLoading ? '...' : `${workerFields.length} fields`}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onManageFields}
            className="gap-2 ml-2"
          >
            <Settings className="h-3 w-3" />
            Manage
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}