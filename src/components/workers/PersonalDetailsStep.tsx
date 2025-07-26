import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateWorkerData } from '@/hooks/useWorkers'
import { useWorkerComplianceCountries } from '@/hooks/useWorkerComplianceCountries'

interface PersonalDetailsStepProps {
  data: Partial<CreateWorkerData>
  errors: Record<string, string>
  onUpdate: (data: Partial<CreateWorkerData>) => void
}

export function PersonalDetailsStep({ data, errors, onUpdate }: PersonalDetailsStepProps) {
  const { countries, isLoading: countriesLoading } = useWorkerComplianceCountries()
  
  const handleChange = (field: keyof CreateWorkerData, value: any) => {
    onUpdate({ [field]: value })
  }

  // Helper function to get the current date components from data.date_of_birth
  const getCurrentDateComponents = () => {
    if (!data.date_of_birth) return { day: '', month: '', year: '' }
    const date = new Date(data.date_of_birth)
    return {
      day: date.getDate().toString(),
      month: (date.getMonth() + 1).toString(),
      year: date.getFullYear().toString()
    }
  }

  // Helper function to handle date component changes
  const handleDateChange = (component: 'day' | 'month' | 'year', value: string) => {
    const current = getCurrentDateComponents()
    const updated = { ...current, [component]: value }
    
    // Only update if all three components are selected
    if (updated.day && updated.month && updated.year) {
      const newDate = `${updated.year}-${updated.month.padStart(2, '0')}-${updated.day.padStart(2, '0')}`
      handleChange('date_of_birth', newDate)
    } else if (!updated.day && !updated.month && !updated.year) {
      // Clear date if all components are empty
      handleChange('date_of_birth', '')
    }
  }

  // Generate arrays for dropdowns
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ]
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i)

  const dateComponents = getCurrentDateComponents()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Legal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="legal_first_name">Legal First Name(s) *</Label>
              <Input
                id="legal_first_name"
                value={data.legal_first_name || ''}
                onChange={(e) => handleChange('legal_first_name', e.target.value)}
                className={errors.legal_first_name ? 'border-destructive' : ''}
              />
              {errors.legal_first_name && (
                <p className="text-sm text-destructive mt-1">{errors.legal_first_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="legal_last_name">Legal Last Name(s) *</Label>
              <Input
                id="legal_last_name"
                value={data.legal_last_name || ''}
                onChange={(e) => handleChange('legal_last_name', e.target.value)}
                className={errors.legal_last_name ? 'border-destructive' : ''}
              />
              {errors.legal_last_name && (
                <p className="text-sm text-destructive mt-1">{errors.legal_last_name}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Select
                    value={dateComponents.day}
                    onValueChange={(value) => handleDateChange('day', value)}
                  >
                    <SelectTrigger className={errors.date_of_birth ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {days.map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Select
                    value={dateComponents.month}
                    onValueChange={(value) => handleDateChange('month', value)}
                  >
                    <SelectTrigger className={errors.date_of_birth ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Select
                    value={dateComponents.year}
                    onValueChange={(value) => handleDateChange('year', value)}
                  >
                    <SelectTrigger className={errors.date_of_birth ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50 max-h-48">
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {errors.date_of_birth && (
                <p className="text-sm text-destructive mt-1">{errors.date_of_birth}</p>
              )}
            </div>

            <div>
              <Label htmlFor="citizenship">Employee's Citizenship</Label>
              <Input
                id="citizenship"
                placeholder="Optional"
                value={data.citizenship || ''}
                onChange={(e) => handleChange('citizenship', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="country">Country of Residence *</Label>
              <Select
                value={data.country || ''}
                onValueChange={(value) => handleChange('country', value)}
              >
                <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countriesLoading ? (
                    <SelectItem value="loading" disabled>Loading countries...</SelectItem>
                  ) : (
                    countries.map((country) => (
                      <SelectItem key={country.id} value={country.name}>
                        {country.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.country && (
                <p className="text-sm text-destructive mt-1">{errors.country}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="personal_email">Personal Email *</Label>
              <Input
                id="personal_email"
                type="email"
                value={data.personal_email || ''}
                onChange={(e) => handleChange('personal_email', e.target.value)}
                className={errors.personal_email ? 'border-destructive' : ''}
              />
              {errors.personal_email && (
                <p className="text-sm text-destructive mt-1">{errors.personal_email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="work_email">Work Email</Label>
              <Input
                id="work_email"
                type="email"
                placeholder="Optional"
                value={data.work_email || ''}
                onChange={(e) => handleChange('work_email', e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="personal_phone">Personal Phone Number *</Label>
              <PhoneInput
                id="personal_phone"
                value={data.personal_phone || ''}
                onChange={(value) => handleChange('personal_phone', value)}
                placeholder="Enter phone number"
                className={errors.personal_phone ? 'border-destructive' : ''}
              />
              {errors.personal_phone && (
                <p className="text-sm text-destructive mt-1">{errors.personal_phone}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}