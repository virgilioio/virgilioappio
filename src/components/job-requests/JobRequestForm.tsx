import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertTriangle, Check, ChevronsUpDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JobRequest } from '@/hooks/useJobRequests'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useJobRequestAgreements } from '@/hooks/useJobRequestAgreements'
import { useCountries } from '@/hooks/useCountries'
import { useOrganizationCustomData } from '@/hooks/useOrganizationCustomData'
import { useCountryFields } from '@/hooks/useCountryFields'
import { CURRENCIES } from '@/constants/currencies'

interface JobRequestFormProps {
  onSubmit: (data: Omit<JobRequest, 'id' | 'submitted_by' | 'organization_id' | 'status' | 'approved_by' | 'created_at' | 'updated_at' | 'job_id'>) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}


export function JobRequestForm({ onSubmit, onCancel, isLoading = false }: JobRequestFormProps) {
  const { hasOrganizationContext, organizationId } = useAuth()
  const { organizations } = useOrganizations()
  const { countries } = useCountries()
  const { getAgreementByCountry } = useJobRequestAgreements()
  const { customData } = useOrganizationCustomData(organizationId)
  
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    level: null as 'L1' | 'L2' | 'L3' | null,
    location: '',
    salary_min: '',
    salary_max: '',
    currency: 'USD',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [currencyOpen, setCurrencyOpen] = useState(false)

  // Get current organization and its country
  const currentOrganization = organizations.find(org => org.id === organizationId)
  const organizationCountry = countries.find(country => country.code === currentOrganization?.country)
  const agreement = organizationCountry ? getAgreementByCountry(organizationCountry.id) : null
  
  // Get country fields for the organization's country
  const { fields } = useCountryFields(currentOrganization?.country)

  console.log('Debug agreement data:', {
    organizationId,
    currentOrganization,
    organizationCountry,
    agreement,
    customData,
    fields,
    agreementContent: agreement?.agreement_content
  })

  // Function to process agreement content with placeholders
  const processAgreementContent = (content: string) => {
    if (!content) return ''
    
    let processedContent = content
    
    // Replace job request placeholders
    processedContent = processedContent.replace(/{{job_title}}/g, formData.title || '[Job Title]')
    processedContent = processedContent.replace(/{{job_description}}/g, formData.description || '[Job Description]')
    processedContent = processedContent.replace(/{{job_department}}/g, formData.department || '[Department]')
    processedContent = processedContent.replace(/{{job_level}}/g, formData.level || '[Level]')
    processedContent = processedContent.replace(/{{job_location}}/g, formData.location || '[Location]')
    processedContent = processedContent.replace(/{{job_salary_min}}/g, formData.salary_min || '[Min Salary]')
    processedContent = processedContent.replace(/{{job_salary_max}}/g, formData.salary_max || '[Max Salary]')
    processedContent = processedContent.replace(/{{job_currency}}/g, formData.currency || 'USD')
    processedContent = processedContent.replace(/{{job_notes}}/g, formData.notes || '[Notes]')
    
    // Replace organization placeholders
    processedContent = processedContent.replace(/{{organization_name}}/g, currentOrganization?.name || '[Organization Name]')
    processedContent = processedContent.replace(/{{organization_country}}/g, currentOrganization?.country || '[Country]')
    
    // Replace custom field placeholders with organization's compliance data
    fields.forEach(field => {
      const customDataEntry = customData.find(data => data.country_field_id === field.id)
      const placeholderKey = `{{${field.field_name}}}`
      const placeholderValue = customDataEntry?.field_value || `[${field.field_label}]`
      
      // Escape special regex characters in the field name for proper matching
      const escapedFieldName = field.field_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`{{${escapedFieldName}}}`, 'g')
      processedContent = processedContent.replace(regex, placeholderValue)
    })
    
    // Replace system placeholders
    processedContent = processedContent.replace(/{{current_date}}/g, new Date().toLocaleDateString())
    processedContent = processedContent.replace(/{{agreement_version}}/g, agreement?.version?.toString() || '1')
    
    return processedContent
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (!formData.department.trim()) {
      newErrors.department = 'Department is required'
    }

    if (!formData.level) {
      newErrors.level = 'Level is required'
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required'
    }

    if (!formData.salary_min.trim()) {
      newErrors.salary_min = 'Minimum salary is required'
    }

    if (!formData.salary_max.trim()) {
      newErrors.salary_max = 'Maximum salary is required'
    }

    if (!formData.currency) {
      newErrors.currency = 'Currency is required'
    }

    if (!formData.notes.trim()) {
      newErrors.notes = 'Notes are required'
    }

    if (formData.salary_min && formData.salary_max) {
      const minSalary = parseInt(formData.salary_min)
      const maxSalary = parseInt(formData.salary_max)
      if (minSalary > maxSalary) {
        newErrors.salary_max = 'Maximum salary must be greater than minimum salary'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateForm()) {
      setCurrentStep(2)
    }
  }

  const handleBack = () => {
    setCurrentStep(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate organization context
    if (!hasOrganizationContext) {
      setErrors({ form: 'Organization context is required to submit job requests' })
      return
    }

    if (!validateForm()) return

    try {
      // Process the agreement content with placeholders replaced
      const processedAgreement = agreement?.agreement_content 
        ? processAgreementContent(agreement.agreement_content)
        : null

      await onSubmit({
        title: formData.title.trim(),
        description: formData.description.trim(),
        department: formData.department.trim(),
        level: formData.level!,
        location: formData.location.trim(),
        salary_min: parseInt(formData.salary_min),
        salary_max: parseInt(formData.salary_max),
        currency: formData.currency,
        notes: formData.notes.trim(),
        agreement_id: agreement?.id,
        processed_agreement_content: processedAgreement
      })
      
      // Reset form on success
      setFormData({
        title: '',
        description: '',
        department: '',
        level: null,
        location: '',
        salary_min: '',
        salary_max: '',
        currency: 'USD',
        notes: ''
      })
      setCurrentStep(1)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleChange = (field: string, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Show organization context warning
  if (!hasOrganizationContext) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Request New Job</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Organization context is required to submit job requests. Please contact your administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Request New Job</span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn("px-2 py-1 rounded", currentStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted")}>
              1. Job Details
            </span>
            <span className={cn("px-2 py-1 rounded", currentStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted")}>
              2. Agreement Review
            </span>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Organization: {currentOrganization?.name || 'Unknown'} | Country: {currentOrganization?.country || 'Unknown'}
        </p>
      </CardHeader>
      <CardContent>
        {errors.form && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}

        {currentStep === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
            
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the role requirements and responsibilities..."
                rows={4}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  placeholder="e.g. Engineering"
                  className={errors.department ? 'border-destructive' : ''}
                />
                {errors.department && (
                  <p className="text-sm text-destructive">{errors.department}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Level *</Label>
                <Select value={formData.level || ''} onValueChange={(value) => handleChange('level', value as 'L1' | 'L2' | 'L3')}>
                  <SelectTrigger className={errors.level ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L1">L1 - Specialists</SelectItem>
                    <SelectItem value="L2">L2 - Managers</SelectItem>
                    <SelectItem value="L3">L3 - Directors/VPs</SelectItem>
                  </SelectContent>
                </Select>
                {errors.level && (
                  <p className="text-sm text-destructive">{errors.level}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="e.g. Remote, New York, London"
                className={errors.location ? 'border-destructive' : ''}
              />
              {errors.location && (
                <p className="text-sm text-destructive">{errors.location}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary_min">Min Salary *</Label>
                <Input
                  id="salary_min"
                  type="number"
                  value={formData.salary_min}
                  onChange={(e) => handleChange('salary_min', e.target.value)}
                  placeholder="50000"
                  className={errors.salary_min ? 'border-destructive' : ''}
                />
                {errors.salary_min && (
                  <p className="text-sm text-destructive">{errors.salary_min}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary_max">Max Salary *</Label>
                <Input
                  id="salary_max"
                  type="number"
                  value={formData.salary_max}
                  onChange={(e) => handleChange('salary_max', e.target.value)}
                  placeholder="80000"
                  className={errors.salary_max ? 'border-destructive' : ''}
                />
                {errors.salary_max && (
                  <p className="text-sm text-destructive">{errors.salary_max}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={currencyOpen}
                      className={cn(
                        "w-full justify-between",
                        errors.currency ? 'border-destructive' : ''
                      )}
                    >
                      {formData.currency
                        ? CURRENCIES.find((currency) => currency.value === formData.currency)?.label
                        : "Select currency..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search currency..." />
                      <CommandList>
                        <CommandEmpty>No currency found.</CommandEmpty>
                        <CommandGroup>
                          {CURRENCIES.map((currency) => (
                            <CommandItem
                              key={currency.value}
                              value={currency.value}
                              onSelect={(currentValue) => {
                                handleChange('currency', currentValue.toUpperCase())
                                setCurrencyOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.currency === currency.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {currency.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.currency && (
                  <p className="text-sm text-destructive">{errors.currency}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes *</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Additional notes or requirements..."
                rows={3}
                className={errors.notes ? 'border-destructive' : ''}
              />
              {errors.notes && (
                <p className="text-sm text-destructive">{errors.notes}</p>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                type="submit" 
                disabled={isLoading || !hasOrganizationContext} 
                className="flex-1"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Next: Review Agreement
              </Button>
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Job Request Agreement</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please review the agreement for {currentOrganization?.country || 'your country'} before submitting your job request.
                {customData.length > 0 && (
                  <span className="block mt-1 text-green-600">
                    ✓ Organization compliance data has been populated in the agreement.
                  </span>
                )}
              </p>
            </div>

            {agreement?.agreement_content ? (
              <div className="border rounded-lg p-6 bg-background max-h-[500px] overflow-y-auto">
                <SafeHtml 
                  content={processAgreementContent(agreement.agreement_content)}
                  className="prose prose-sm max-w-none"
                />
              </div>
            ) : (
              <div className="p-6 border rounded-lg bg-muted/30">
                <p className="text-muted-foreground text-center">
                  No agreement template available for {currentOrganization?.country || 'your country'}.
                  <br />
                  Please contact your administrator to set up the agreement template.
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Form
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isLoading || !hasOrganizationContext} 
                className="flex-1"
              >
                {isLoading ? 'Submitting...' : 'Submit Job Request'}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
