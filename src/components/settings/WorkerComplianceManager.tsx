import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Edit, Trash2, FileText, Globe } from 'lucide-react'
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
  const { countries, isLoading: countriesLoading } = useCountries()
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Worker Compliance</h2>
        <p className="text-muted-foreground">
          Configure compliance fields and requirements for workers by country
        </p>
      </div>

      <Tabs defaultValue="fields" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fields" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Compliance Fields
          </TabsTrigger>
          <TabsTrigger value="countries" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Country Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Fields by Country</CardTitle>
              <CardDescription>
                Manage worker compliance requirements for different countries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="country-select">Select Country</Label>
                  <Select value={selectedCountry} onValueChange={handleCountryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a country to manage compliance fields" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries?.map((country) => (
                        <SelectItem key={country.id} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCountry && (
                  <Button onClick={handleAddField} className="mt-6">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Field
                  </Button>
                )}
              </div>

              {selectedCountry && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Compliance Fields for {countries?.find(c => c.code === selectedCountry)?.name}
                    </h3>
                    <Badge variant="outline">
                      {fields?.length || 0} fields configured
                    </Badge>
                  </div>

                  {fieldsLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading fields...</p>
                    </div>
                  ) : (
                    <CountryFieldsList 
                      fields={fields || []}
                      onEdit={handleEditField}
                      onRefetch={refetch}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="countries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Countries Overview</CardTitle>
              <CardDescription>
                Overview of compliance field configurations across all countries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {countriesLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading countries...</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {countries?.map((country) => (
                    <Card key={country.id} className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            setSelectedCountry(country.code)
                            // Switch to fields tab
                            const tabsList = document.querySelector('[role="tablist"]')
                            const fieldsTab = tabsList?.querySelector('[value="fields"]') as HTMLButtonElement
                            fieldsTab?.click()
                          }}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{country.name}</h4>
                          <Badge variant="secondary">
                            {country.code}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Click to configure compliance fields
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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