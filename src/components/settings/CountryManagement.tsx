
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Globe, Settings } from 'lucide-react'
import { useCountries } from '@/hooks/useCountries'
import { CountryForm } from './CountryForm'
import { CountryFieldsManager } from './CountryFieldsManager'

export function CountryManagement() {
  const { countries, isLoading, deleteCountry } = useCountries()
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCountry, setEditingCountry] = useState<any>(null)

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

  if (selectedCountry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="outline"
              onClick={() => setSelectedCountry(null)}
              className="mb-4"
            >
              ← Back to Countries
            </Button>
            <h2 className="text-xl font-semibold">
              Manage Fields for {countries.find(c => c.id === selectedCountry)?.name}
            </h2>
          </div>
        </div>
        <CountryFieldsManager countryId={selectedCountry} />
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
                <Globe className="h-5 w-5" />
                Country Management
              </CardTitle>
              <CardDescription>
                Manage countries and their custom field requirements
              </CardDescription>
            </div>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Country
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.map((country) => (
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCountry(country.id)}
                        className="gap-2"
                      >
                        <Settings className="h-3 w-3" />
                        Manage Fields
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(country)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(country.id)}
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

      <CountryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        country={editingCountry}
      />
    </div>
  )
}
