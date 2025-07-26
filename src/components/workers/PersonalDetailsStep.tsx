import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CreateWorkerData } from '@/hooks/useWorkers'
import { useWorkerComplianceCountries } from '@/hooks/useWorkerComplianceCountries'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

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

            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !data.date_of_birth && "text-muted-foreground",
                      errors.date_of_birth && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data.date_of_birth ? 
                      format(new Date(data.date_of_birth), "PPP") : 
                      <span>Pick a date</span>
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data.date_of_birth ? new Date(data.date_of_birth) : undefined}
                    onSelect={(date) => handleChange('date_of_birth', date ? format(date, 'yyyy-MM-dd') : '')}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    defaultMonth={data.date_of_birth ? new Date(data.date_of_birth) : new Date(1990, 0)}
                    captionLayout="dropdown-buttons"
                    fromYear={1900}
                    toYear={new Date().getFullYear()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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