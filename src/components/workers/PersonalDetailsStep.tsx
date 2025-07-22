import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateWorkerData } from '@/hooks/useWorkers'
import { COUNTRIES } from '@/constants/countries'

interface PersonalDetailsStepProps {
  data: Partial<CreateWorkerData>
  errors: Record<string, string>
  onUpdate: (data: Partial<CreateWorkerData>) => void
}

export function PersonalDetailsStep({ data, errors, onUpdate }: PersonalDetailsStepProps) {
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
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.value} value={country.label}>
                      {country.label}
                    </SelectItem>
                  ))}
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