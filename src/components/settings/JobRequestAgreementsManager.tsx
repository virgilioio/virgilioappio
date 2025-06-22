import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { AgreementRichTextEditor } from '@/components/ui/agreement-rich-text-editor'
import { useJobRequestAgreements } from '@/hooks/useJobRequestAgreements'
import { useCountries } from '@/hooks/useCountries'
import { useToast } from '@/hooks/use-toast'
import { Edit, Lock, Save, X, FileText, Globe, Plus } from 'lucide-react'

export function JobRequestAgreementsManager() {
  const { countries } = useCountries()
  const { 
    agreements, 
    isLoading, 
    isUpdating, 
    getAgreementByCountry, 
    createOrUpdateAgreement 
  } = useJobRequestAgreements()
  const { toast } = useToast()

  const [selectedCountryId, setSelectedCountryId] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [agreementContent, setAgreementContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')

  const activeCountries = countries.filter(country => country.is_active)
  const selectedCountry = activeCountries.find(c => c.id === selectedCountryId)
  const currentAgreement = selectedCountryId ? getAgreementByCountry(selectedCountryId) : null

  useEffect(() => {
    if (currentAgreement && currentAgreement.agreement_content) {
      setAgreementContent(currentAgreement.agreement_content)
    } else {
      setAgreementContent('')
    }
    setIsEditing(false)
  }, [currentAgreement, selectedCountryId])

  const handleCountryChange = (countryId: string) => {
    if (isEditing) {
      toast({
        title: 'Save Changes',
        description: 'Please save or cancel your current changes before switching countries.',
        variant: 'destructive'
      })
      return
    }
    setSelectedCountryId(countryId)
  }

  const handleEdit = () => {
    // Store the current agreementContent (which is what's being displayed) as original
    setOriginalContent(agreementContent)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!selectedCountryId) return
    
    const success = await createOrUpdateAgreement(
      selectedCountryId, 
      agreementContent, 
      currentAgreement?.id
    )
    
    if (success) {
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setAgreementContent(originalContent)
    setIsEditing(false)
  }

  const getAgreementStatusForCountry = (countryId: string) => {
    const agreement = getAgreementByCountry(countryId)
    if (!agreement) return { status: 'missing', label: 'No Agreement', variant: 'secondary' as const }
    if (!agreement.agreement_content) return { status: 'draft', label: 'Draft', variant: 'outline' as const }
    return { status: 'active', label: 'Active', variant: 'default' as const }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading job request agreements...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Country Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Job Request Service Agreements
          </CardTitle>
          <CardDescription>
            Manage country-specific service agreements for job requests with dynamic placeholders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCountries.map((country) => {
              const status = getAgreementStatusForCountry(country.id)
              return (
                <div 
                  key={country.id}
                  className="p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleCountryChange(country.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span className="font-medium">{country.name}</span>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {country.code}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Agreement Editor */}
      {selectedCountryId && selectedCountry && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                Service Agreement - {selectedCountry.name}
                {!isEditing && <Lock className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {currentAgreement 
                  ? `Version ${currentAgreement.version} • Last updated ${new Date(currentAgreement.updated_at).toLocaleDateString()}`
                  : 'Create a new service agreement for this country'
                }
              </CardDescription>
            </div>
            {!isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    {currentAgreement ? 'Edit' : 'Create'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {currentAgreement ? 'Edit Service Agreement' : 'Create Service Agreement'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      You are about to {currentAgreement ? 'edit' : 'create'} a service agreement for {selectedCountry.name}. 
                      This is a legal document that affects job requests. Are you sure you want to proceed?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEdit}>
                      Yes, {currentAgreement ? 'Edit' : 'Create'} Agreement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <FormField 
                  label="Agreement Content"
                  helpText="Use the rich text editor and insert placeholders that will be replaced with actual data when generating agreements"
                >
                  <AgreementRichTextEditor
                    value={agreementContent}
                    onChange={setAgreementContent}
                    selectedCountryId={selectedCountryId}
                    placeholder="Enter the service agreement template with placeholders..."
                    minHeight="400px"
                  />
                </FormField>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isUpdating ? 'Saving...' : 'Save Agreement'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCancel}
                    disabled={isUpdating}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="min-h-[300px] p-4 border rounded-md bg-muted/30">
                {agreementContent ? (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: agreementContent }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No service agreement created for {selectedCountry.name} yet
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Click "Create" to add a new agreement template
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Getting Started */}
      {!selectedCountryId && (
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Country</h3>
            <p className="text-muted-foreground mb-4">
              Choose a country from the overview above to create or edit its service agreement template
            </p>
            <p className="text-sm text-muted-foreground">
              Each country can have its own customized agreement with placeholders that pull from the country's configured fields
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
