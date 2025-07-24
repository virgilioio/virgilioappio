import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Settings, FileText, Users } from 'lucide-react'
import { useCountries } from '@/hooks/useCountries'
import { useCountryFields } from '@/hooks/useCountryFields'
import { WorkerFieldsManager } from './WorkerFieldsManager'

export function WorkerComplianceManager() {
  const { countries, isLoading: countriesLoading } = useCountries()
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null)
  const [isManagingFields, setIsManagingFields] = useState(false)

  const selectedCountry = countries.find(c => c.id === selectedCountryId)

  const handleManageFields = (countryId: string) => {
    setSelectedCountryId(countryId)
    setIsManagingFields(true)
  }

  const handleBackToList = () => {
    setIsManagingFields(false)
    setSelectedCountryId(null)
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Worker Compliance Management</h2>
          <p className="text-muted-foreground">
            Manage country-specific compliance requirements for workers
          </p>
        </div>
      </div>

      {countriesLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <CountryComplianceCard 
              key={country.id}
              country={country}
              onManageFields={() => handleManageFields(country.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CountryComplianceCardProps {
  country: any
  onManageFields: () => void
}

function CountryComplianceCard({ country, onManageFields }: CountryComplianceCardProps) {
  const { fields, isLoading } = useCountryFields(country.code)

  const workerFields = fields.filter(field => 
    field.field_name.includes('worker_') || 
    field.field_label.toLowerCase().includes('worker') ||
    field.field_label.toLowerCase().includes('employee')
  )

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {country.name}
          <Badge variant="outline" className="text-xs">
            {country.code}
          </Badge>
        </CardTitle>
        <CardDescription>
          Worker compliance requirements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Worker Fields:</span>
          <Badge variant="secondary">
            {isLoading ? '...' : workerFields.length}
          </Badge>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={onManageFields}
            size="sm" 
            className="flex-1"
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Fields
          </Button>
        </div>

        {workerFields.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Recent fields:</p>
            <div className="space-y-1">
              {workerFields.slice(0, 3).map((field) => (
                <div key={field.id} className="flex items-center gap-2 text-xs">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{field.field_label}</span>
                  <Badge variant="outline" className="text-xs">
                    {field.field_type}
                  </Badge>
                </div>
              ))}
              {workerFields.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{workerFields.length - 3} more...
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}