
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
import { AlertTriangle, Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JobRequest } from '@/hooks/useJobRequests'
import { useAuth } from '@/contexts/AuthContext'

interface JobRequestFormProps {
  onSubmit: (data: Omit<JobRequest, 'id' | 'submitted_by' | 'organization_id' | 'status' | 'approved_by' | 'created_at' | 'updated_at' | 'job_id'>) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const currencies = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'KRW', label: 'KRW - South Korean Won' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { value: 'NOK', label: 'NOK - Norwegian Krone' },
  { value: 'SEK', label: 'SEK - Swedish Krona' },
  { value: 'DKK', label: 'DKK - Danish Krone' },
  { value: 'PLN', label: 'PLN - Polish Zloty' },
  { value: 'CZK', label: 'CZK - Czech Koruna' },
  { value: 'HUF', label: 'HUF - Hungarian Forint' },
  { value: 'RUB', label: 'RUB - Russian Ruble' },
  { value: 'BRL', label: 'BRL - Brazilian Real' },
  { value: 'MXN', label: 'MXN - Mexican Peso' },
  { value: 'ARS', label: 'ARS - Argentine Peso' },
  { value: 'CLP', label: 'CLP - Chilean Peso' },
  { value: 'COP', label: 'COP - Colombian Peso' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
  { value: 'TRY', label: 'TRY - Turkish Lira' },
  { value: 'ILS', label: 'ILS - Israeli Shekel' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'EGP', label: 'EGP - Egyptian Pound' },
  { value: 'THB', label: 'THB - Thai Baht' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit' },
  { value: 'IDR', label: 'IDR - Indonesian Rupiah' },
  { value: 'PHP', label: 'PHP - Philippine Peso' },
  { value: 'VND', label: 'VND - Vietnamese Dong' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' }
]

export function JobRequestForm({ onSubmit, onCancel, isLoading = false }: JobRequestFormProps) {
  const { hasOrganizationContext, organizationId } = useAuth()
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (!formData.level) {
      newErrors.level = 'Level is required'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate organization context
    if (!hasOrganizationContext) {
      setErrors({ form: 'Organization context is required to submit job requests' })
      return
    }

    if (!validateForm()) return

    try {
      await onSubmit({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        department: formData.department.trim() || undefined,
        level: formData.level!,
        location: formData.location.trim() || undefined,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : undefined,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : undefined,
        currency: formData.currency || undefined,
        notes: formData.notes.trim() || undefined
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Request New Job</CardTitle>
        <p className="text-sm text-muted-foreground">
          Organization: {organizationId}
        </p>
      </CardHeader>
      <CardContent>
        {errors.form && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe the role requirements and responsibilities..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="e.g. Engineering"
              />
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
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g. Remote, New York, London"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary_min">Min Salary</Label>
              <Input
                id="salary_min"
                type="number"
                value={formData.salary_min}
                onChange={(e) => handleChange('salary_min', e.target.value)}
                placeholder="50000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_max">Max Salary</Label>
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
              <Label htmlFor="currency">Currency</Label>
              <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={currencyOpen}
                    className="w-full justify-between"
                  >
                    {formData.currency
                      ? currencies.find((currency) => currency.value === formData.currency)?.label
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
                        {currencies.map((currency) => (
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes or requirements..."
              rows={3}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button 
              type="submit" 
              disabled={isLoading || !hasOrganizationContext} 
              className="flex-1"
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
