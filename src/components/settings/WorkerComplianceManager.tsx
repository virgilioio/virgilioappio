import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit, Trash2, FileText, Globe, Settings, UserCheck } from 'lucide-react'
import { WorkerComplianceFieldForm } from './WorkerComplianceFieldForm'
import { CountryFieldsList } from './CountryFieldsList'
import { useCountries } from '@/hooks/useCountries'
import { useWorkerComplianceFields } from '@/hooks/useWorkerComplianceFields'
import { toast } from 'sonner'

export function WorkerComplianceManager() {
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCountryId, setSelectedCountryId] = useState<string>('')
  const [showFieldForm, setShowFieldForm] = useState(false)
  const [editingField, setEditingField] = useState<any>(null)
  const { countries, isLoading: countriesLoading, deleteCountry } = useCountries()
  const { fields, isLoading: fieldsLoading, refetch } = useWorkerComplianceFields(selectedCountry)

  const handleFieldSaved = () => {
    setShowFieldForm(false)
    setEditingField(null)
    refetch()
    toast.success('Field saved successfully')
  }

  const handleEditField = (field: any) => {
    setEditingField(field)
    setShowFieldForm(true)
  }

  const handleAddField = () => {
    setEditingField(null)
    setShowFieldForm(true)
  }

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode)
    const country = countries?.find(c => c.code === countryCode)
    setSelectedCountryId(country?.id || '')
  }

  const handleManageFields = (countryCode: string) => {
    handleCountryChange(countryCode)
  }

  const handleDeleteCountry = async (countryId: string) => {
    if (confirm('Are you sure you want to deactivate this country? This will affect all compliance configurations.')) {
      await deleteCountry(countryId)
    }
  }

  if (selectedCountry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCountry('')
                setSelectedCountryId('')
              }}
              className="mb-4"
            >
              ← Back to Countries
            </Button>
            <h2 className="text-xl font-semibold">
              Worker Compliance for {countries?.find(c => c.code === selectedCountry)?.name}
            </h2>
          </div>
          <Button onClick={handleAddField} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Field
          </Button>
        </div>
        <CountryFieldsList 
          fields={fields || []}
          onEdit={handleEditField}
          onRefetch={refetch}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <UserCheck className="h-5 w-5" />
                Worker Compliance
              </CardTitle>
              <CardDescription>
                Configure compliance fields and requirements for workers by country
              </CardDescription>
            </div>
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
                  <TableHead>Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries?.map((country) => (
                  <TableRow key={country.id}>
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
                      <Badge variant="outline">
                        0 fields configured
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageFields(country.code)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCountry(country.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showFieldForm && (
        <WorkerComplianceFieldForm
          isOpen={showFieldForm}
          onClose={() => {
            setShowFieldForm(false)
            setEditingField(null)
          }}
          countryId={selectedCountryId}
          countryCode={selectedCountry}
          field={editingField}
          onFieldChange={handleFieldSaved}
        />
      )}
    </div>
  )
}